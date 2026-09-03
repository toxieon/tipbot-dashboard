<?php
// API HANDOFF NOTES
// No bot token, Discord token, or paid API key is required for this endpoint.
// The static dashboard calls this file from the same neilldata.com origin.
// This file fetches AFL's public fixture API server-side, which avoids browser
// CORS blocks and lets the dashboard show games even when the Render bot sleeps.
// Selected teams, live player stats, and scheduling still use the bot backend.

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=90');

const AFL_BASE = 'https://aflapi.afl.com.au/afl/v2';
const AFL_COMP_ID = 1;

function fail_json(int $status, string $message, array $extra = []): void
{
    http_response_code($status);
    echo json_encode(array_merge([
        'generatedAt' => gmdate('c'),
        'games' => [],
        'players' => [
            'enabled' => false,
            'playerCount' => 0,
            'matchedTeams' => 0,
            'selectedPlayerCount' => 0,
            'selectedTeamCount' => 0,
            'selectedGameCount' => 0,
            'selectionErrors' => 0,
            'fixtureSource' => 'afl-dashboard',
            'warning' => null,
            'error' => $message,
        ],
        'error' => $message,
    ], $extra), JSON_UNESCAPED_SLASHES);
    exit;
}

function http_json(string $url): array
{
    $ua = 'TipBot Dashboard fixture proxy (https://www.neilldata.com/tipbot-dashboard/)';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_USERAGENT => $ua,
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($body === false || $code >= 400) {
            throw new RuntimeException($err ?: "HTTP {$code} from AFL API");
        }
    } else {
        $ctx = stream_context_create([
            'http' => [
                'header' => "Accept: application/json\r\nUser-Agent: {$ua}\r\n",
                'timeout' => 15,
            ],
        ]);
        $body = @file_get_contents($url, false, $ctx);
        if ($body === false) {
            throw new RuntimeException('AFL API request failed');
        }
    }

    $data = json_decode((string) $body, true);
    if (!is_array($data)) {
        throw new RuntimeException('AFL API returned invalid JSON');
    }
    return $data;
}

function list_from($data, array $keys): array
{
    if (is_array($data) && array_keys($data) === range(0, count($data) - 1)) {
        return $data;
    }
    if (is_array($data)) {
        foreach ($keys as $key) {
            if (isset($data[$key]) && is_array($data[$key])) {
                return $data[$key];
            }
        }
    }
    return [];
}

function comp_season_for_year(array $seasons, int $year): ?array
{
    foreach ($seasons as $season) {
        if ((string) ($season['year'] ?? '') === (string) $year) {
            return $season;
        }
    }
    foreach ($seasons as $season) {
        if (strpos((string) ($season['name'] ?? ''), (string) $year) !== false) {
            return $season;
        }
    }
    return null;
}

function parse_match_start(array $match): ?int
{
    $raw = $match['utcStartTime'] ?? $match['venueLocalStartTime'] ?? $match['date'] ?? $match['startTime'] ?? null;
    if (!$raw) {
        return null;
    }
    $normal = preg_replace('/([+-]\d{2})(\d{2})$/', '$1:$2', (string) $raw);
    $ts = strtotime((string) $normal);
    return $ts === false ? null : $ts;
}

function dashboard_team_name(string $name): string
{
    $map = [
        'Adelaide Crows' => 'Adelaide',
        'Geelong Cats' => 'Geelong',
        'Gold Coast SUNS' => 'Gold Coast',
        'GWS GIANTS' => 'Greater Western Sydney',
        'Sydney Swans' => 'Sydney',
        'West Coast Eagles' => 'West Coast',
    ];
    return $map[$name] ?? $name;
}

function side_obj(array $match, string $side): array
{
    $team = $match[$side]['team'] ?? $match[$side . 'Team']['team'] ?? $match[$side . 'Team'] ?? [];
    if (!is_array($team)) {
        $team = [];
    }
    $name = (string) ($team['name'] ?? $team['teamName'] ?? $team['fullName'] ?? '');
    return [
        'name' => dashboard_team_name($name),
        'abbrev' => (string) ($team['abbreviation'] ?? $team['abbrev'] ?? $team['shortName'] ?? ''),
        'players' => [],
        'aflTeamId' => $team['id'] ?? $team['teamId'] ?? null,
        'aflName' => $name,
        'playerListType' => 'none',
        'selectionStatus' => '',
        'ins' => [],
        'outs' => [],
    ];
}

function is_placeholder_side(array $side): bool
{
    $text = strtolower(trim(($side['name'] ?? '') . ' ' . ($side['abbrev'] ?? '') . ' ' . ($side['aflName'] ?? '')));
    return $text === '' || strpos($text, 'tbd') !== false || strpos($text, 'winner of') !== false || strpos($text, 'loser of') !== false;
}

function round_name(array $match): string
{
    $round = $match['round'] ?? [];
    if (!is_array($round)) {
        return '';
    }
    return (string) ($round['name'] ?? $round['abbreviation'] ?? '');
}

function round_number(array $match)
{
    $round = $match['round'] ?? [];
    return is_array($round) ? ($round['roundNumber'] ?? null) : null;
}

function score_value(array $match, string $side, string $key)
{
    $score = $match[$side]['score'] ?? [];
    return is_array($score) ? ($score[$key] ?? null) : null;
}

function complete_value(string $status): int
{
    if ($status === 'CONCLUDED') {
        return 100;
    }
    if (in_array($status, ['LIVE', 'IN_PROGRESS', 'INPROGRESS'], true)) {
        return 50;
    }
    return 0;
}

function fixture_games(int $days): array
{
    $season_payload = http_json(AFL_BASE . '/competitions/' . AFL_COMP_ID . '/compseasons?pageSize=100');
    $seasons = list_from($season_payload, ['compSeasons', 'compseasons', 'seasons']);
    $now = time();
    $horizon = $now + ($days * 86400);
    $years = array_values(array_unique([(int) date('Y', $now), (int) date('Y', $horizon)]));
    $games = [];
    $seen = [];

    foreach ($years as $year) {
        $season = comp_season_for_year($seasons, $year);
        if (!$season || empty($season['id'])) {
            continue;
        }
        $match_payload = http_json(AFL_BASE . '/matches?compSeasonId=' . urlencode((string) $season['id']) . '&pageSize=1000');
        foreach (list_from($match_payload, ['matches', 'matchList']) as $match) {
            if (!is_array($match)) {
                continue;
            }
            $status = strtoupper((string) ($match['status'] ?? ''));
            if ($status === 'PLACEHOLDER' || $status === 'CONCLUDED') {
                continue;
            }
            $start = parse_match_start($match);
            if ($start === null) {
                continue;
            }
            $live = in_array($status, ['LIVE', 'IN_PROGRESS', 'INPROGRESS'], true);
            if (!$live && ($start < $now - 4 * 3600 || $start > $horizon)) {
                continue;
            }
            $home = side_obj($match, 'home');
            $away = side_obj($match, 'away');
            if (is_placeholder_side($home) || is_placeholder_side($away)) {
                continue;
            }
            $id = (string) ($match['providerId'] ?? $match['id'] ?? ($home['name'] . '-' . $away['name'] . '-' . $start));
            if (isset($seen[$id])) {
                continue;
            }
            $seen[$id] = true;
            $venue = $match['venue'] ?? [];
            $games[] = [
                'id' => $match['id'] ?? $id,
                'date' => gmdate('Y-m-d H:i:s', $start),
                'unixtime' => $start,
                'live' => $live,
                'complete' => complete_value($status),
                'aflMatchId' => $match['providerId'] ?? null,
                'aflStatus' => $status,
                'venue' => is_array($venue) ? (string) ($venue['name'] ?? $venue['abbreviation'] ?? '') : '',
                'round' => round_number($match),
                'roundname' => round_name($match),
                'game_name' => $home['name'] . ' v ' . $away['name'],
                'hteam' => $home,
                'ateam' => $away,
                'hscore' => score_value($match, 'home', 'totalScore'),
                'ascore' => score_value($match, 'away', 'totalScore'),
                'hgoals' => score_value($match, 'home', 'goals'),
                'hbehinds' => score_value($match, 'home', 'behinds'),
                'agoals' => score_value($match, 'away', 'goals'),
                'abehinds' => score_value($match, 'away', 'behinds'),
                'year' => $year,
            ];
        }
    }

    usort($games, function ($a, $b) {
        return ($a['unixtime'] ?? 0) <=> ($b['unixtime'] ?? 0);
    });
    return $games;
}

$days = isset($_GET['days']) ? (int) $_GET['days'] : 7;
$days = max(1, min(30, $days));

try {
    $games = fixture_games($days);
    echo json_encode([
        'generatedAt' => gmdate('c'),
        'games' => $games,
        'players' => [
            'enabled' => false,
            'playerCount' => 0,
            'matchedTeams' => 0,
            'selectedPlayerCount' => 0,
            'selectedTeamCount' => 0,
            'selectedGameCount' => 0,
            'selectionErrors' => 0,
            'fixtureSource' => 'afl-dashboard',
            'warning' => 'Fixture-only mode; bot adds selected players, live stats, and scheduling.',
            'error' => null,
        ],
        'source' => [
            'games' => 'https://aflapi.afl.com.au/afl/v2',
        ],
    ], JSON_UNESCAPED_SLASHES);
} catch (Throwable $exc) {
    fail_json(502, 'AFL fixture API unavailable', ['detail' => $exc->getMessage()]);
}
