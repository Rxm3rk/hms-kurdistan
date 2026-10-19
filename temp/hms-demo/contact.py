from PIL import Image, ImageDraw, ImageFont
import os
order=['home','patients','appointments','outpatient','emergency','ward','nursing','theatre','icu','maternity','chart','orders','emar','lab','billing','labworklist','radiology','pharmacy','bloodbank','inventory','cashier','insurance','dashboard','quality','staff','reports','messaging','admin','ward-ar']
names={'home':'Home','patients':'Patients','appointments':'Appointments & queue','outpatient':'Outpatient','emergency':'Emergency','ward':'Ward & beds','nursing':'Nursing worklist','theatre':'Operating theatres','icu':'Intensive care','maternity':'Maternity & newborns','chart':'Patient chart','orders':'Orders','emar':'Medication rounds','lab':'Lab results','billing':'Billing','labworklist':'Lab worklist','radiology':'Radiology','pharmacy':'Pharmacy','bloodbank':'Blood bank','inventory':'Stores & inventory','cashier':'Cashier','insurance':'Insurance & companies','dashboard':"Owner's dashboard",'quality':'Quality & safety','staff':'Staff & rosters','reports':'Reports & returns','messaging':'Patient messaging','admin':'Administration','ward-ar':'Ward & beds (Arabic)'}
cols=4; tw,th=470,275; pad=14; lab=30
rows=(len(order)+cols-1)//cols
W=cols*(tw+pad)+pad; H=rows*(th+lab+pad)+pad+50
sheet=Image.new('RGB',(W,H),(244,246,249)); d=ImageDraw.Draw(sheet)
f=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',18); ft=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',26)
d.text((pad,12),'HMS Kurdistan clickable prototype: 28 screens (synthetic data, prototype)',fill=(20,40,80),font=ft)
for i,n in enumerate(order):
    r,c=divmod(i,cols); x=pad+c*(tw+pad); y=50+pad+r*(th+lab+pad)
    im=Image.open(f'all/{n}.png').convert('RGB'); im.thumbnail((tw,th))
    sheet.paste(im,(x,y+lab)); d.rectangle([x,y+lab,x+im.width-1,y+lab+im.height-1],outline=(200,205,215))
    d.text((x,y+4),f'{i+1}. {names[n]}',fill=(20,40,80),font=f)
sheet.save('all-screens.jpg',quality=82); print(sheet.size, os.path.getsize('all-screens.jpg')//1024,'KB')
