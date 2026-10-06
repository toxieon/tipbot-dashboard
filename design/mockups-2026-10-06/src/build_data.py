import json, random
d=json.load(open('tips.json')); t=d['tips']
w=sum(x['res']=='W' for x in t); n=len(t); prof=sum(x['pl'] for x in t); st=sum(x['stake'] for x in t)
last10=[x['res'] for x in t[-10:]]
streak=0
for x in reversed(t):
    if x['res']=='W': streak+=1
    else: break
summary=dict(name="MidfieldMick",handle="midfieldmick",server="Footy Edge",tips=n,wins=w,losses=n-w,
  sr=round(w/n*100,1),units=round(prof,1),staked=round(st,1),roi=round(prof/st*100,1),
  last10=last10,last10w=last10.count('W'),last10l=last10.count('L'),streak=streak,
  avgOdds=round(sum(x['odds'] for x in t)/n,2))
pending=dict(rnd=24,match="Sydney v Collingwood",venue="SCG",time="Fri 7:40pm",sel="Sydney −12.5",odds=1.90,stake=2,book="Sportsbet",res="P")
recent=list(reversed(t[-6:]))
# round-level series (cumulative at end of each round)
rs=[0]; c=0
for r in range(1,24):
    c+=sum(x['pl'] for x in t if x['rnd']==r); rs.append(round(c,2))
# follower (fake) - Jess
r=random.Random(7)
tipsters=[dict(name="MidfieldMick",pl=142.80,bets=18,verified=True),dict(name="The Punting Prof",pl=61.20,bets=14,verified=True),
  dict(name="RaceDayRhi",pl=18.90,bets=11,verified=True),dict(name="Longshot Larry",pl=-36.50,bets=12,verified=False)]
total=round(sum(x['pl'] for x in tipsters),2)
books=[("Sportsbet",21),("TAB",13),("Ladbrokes",10),("Neds",7),("Pointsbet",4)]
# daily cumulative P&L for 30 days ending at total
for seed in range(1,999):
    r=random.Random(seed); days=[r.gauss(6.2,22) for _ in range(30)]
    s=sum(days); days=[x+(total-s)/30 for x in days]
    cum=[];c=0
    for x in days: c+=x; cum.append(round(c,2))
    if min(cum)>-30 and min(cum)<-5 and max(cum[:25])<total-10 and cum[14]>40 and cum[20]<cum[14]: break
cum[-1]=total
follower=dict(name="Jess",bankroll=1284.50,start=round(1284.50-total,2),month="September",monthPL=total,
  monthPct=round(total/(1284.50-total)*100,1),tipsters=tipsters,books=books,bets=sum(b for _,b in books),daily=cum,unit=20)
out=dict(summary=summary,series=d['series'],roundSeries=rs,recent=recent,pending=pending,follower=follower)
open('data.js','w').write('window.TB='+json.dumps(out,ensure_ascii=False)+';\n')
print(json.dumps(summary)); print(follower['start'],follower['monthPct'],follower['bets'],seed,cum)
