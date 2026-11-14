"""Tạo lại 3 sơ đồ C4 của Task 3.1 (.drawio + .svg) từ cùng một mô tả.

Chạy từ thư mục gốc repo:  python tools/render_c4_diagrams.py
Chỉ cần Python 3 (không cần thư viện ngoài).
Nếu sửa trực tiếp file .drawio, hãy cập nhật lại mô tả trong script này trước khi tái xuất
để không mất thay đổi.
"""
import math, os
from xml.sax.saxutils import escape

os.makedirs('docs/diagrams/exports', exist_ok=True)
os.makedirs('docs/diagrams/sources', exist_ok=True)

STY = {  # kind: (fill, stroke, textcolor)
 'person':('#08427B','#073B6F','#ffffff'),
 'system':('#1168BD','#0B4884','#ffffff'),
 'container':('#438DD5','#3C7FC0','#ffffff'),
 'db':('#438DD5','#3C7FC0','#ffffff'),
 'external':('#8A8A8A','#6B6B6B','#ffffff'),
 'component':('#BBD9F5','#5B9BD5','#10243a'),
 'bar':('#ECECEC','#9A9A9A','#222222'),
 'boundary':('none','#444444','#222222'),
 'future':('#FFFFFF','#888888','#555555'),
}

def clip(n, p):
    cx, cy = n['x']+n['w']/2, n['y']+n['h']/2
    dx, dy = p[0]-cx, p[1]-cy
    if dx==0 and dy==0: return (cx,cy)
    sx = (n['w']/2)/abs(dx) if dx else 1e9
    sy = (n['h']/2)/abs(dy) if dy else 1e9
    s = min(sx, sy)
    return (cx+dx*s, cy+dy*s)

def center(n): return (n['x']+n['w']/2, n['y']+n['h']/2)

def route(N, e):
    a, b = N[e['s']], N[e['t']]
    via = list(e.get('via', []))
    if 'bend' in e:
        ca, cb = center(a), center(b)
        mx, my = (ca[0]+cb[0])/2, (ca[1]+cb[1])/2
        dx, dy = cb[0]-ca[0], cb[1]-ca[1]
        L = math.hypot(dx, dy) or 1
        via = [(mx - dy/L*e['bend'], my + dx/L*e['bend'])]
    first = via[0] if via else center(b)
    last = via[-1] if via else center(a)
    return [clip(a, first)] + via + [clip(b, last)]

def lines_html(n):
    ls = n['lines']
    return '<b>%s</b>' % ls[0] + ''.join('<br>%s' % l for l in ls[1:])

def build(name, W, H, nodes, edges, title):
    N = {n['id']: n for n in nodes}
    # ---------- SVG ----------
    o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" font-family="Arial, Helvetica, sans-serif">' % (W,H,W,H),
         '<title>%s</title>' % escape(title),
         '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#444"/></marker></defs>',
         '<rect width="%d" height="%d" fill="#ffffff"/>' % (W,H)]
    for n in nodes:
        f, s, t = STY[n['kind']]
        x,y,w,h = n['x'],n['y'],n['w'],n['h']
        if n['kind']=='boundary':
            o.append('<rect x="%g" y="%g" width="%g" height="%g" fill="none" stroke="%s" stroke-width="1.5" stroke-dasharray="7 5"/>' % (x,y,w,h,s))
            o.append('<text x="%g" y="%g" font-size="14" font-weight="bold" fill="%s">%s</text>' % (x+10,(y+h-12) if n.get('low') else y+20,t,escape(n['lines'][0])))
            continue
        if n['kind']=='db':
            r=10
            o.append('<path d="M%g,%g a%g,%g 0 0 1 %g,0 v%g a%g,%g 0 0 1 %g,0 z" fill="%s" stroke="%s" stroke-width="1.5"/>' % (x,y+r,w/2,r,w,h-2*r,w/2,r,-w,f,s))
            o.append('<path d="M%g,%g a%g,%g 0 0 0 %g,0" fill="none" stroke="%s" stroke-width="1.5"/>' % (x,y+r,w/2,r,w,s))
            off = r/2
        else:
            o.append('<rect x="%g" y="%g" width="%g" height="%g" rx="8" fill="%s" stroke="%s" stroke-width="1.5"%s/>' % (x,y,w,h,f,s,' stroke-dasharray="6 4"' if n['kind']=='future' else ''))
            off = 0
        ls = n['lines']; lh = 16
        y0 = y + h/2 + off - (len(ls)-1)*lh/2 + 5
        for i,l in enumerate(ls):
            o.append('<text x="%g" y="%g" text-anchor="middle" font-size="%d" %s fill="%s">%s</text>' % (x+w/2, y0+i*lh, 13 if i==0 else 11, 'font-weight="bold"' if i==0 else '', t, escape(l)))
    for e in edges:
        pts = route(N, e)
        o.append('<polyline points="%s" fill="none" stroke="#444" stroke-width="1.5" marker-end="url(#ar)"/>' % ' '.join('%.1f,%.1f'%p for p in pts))
        # label at half length
        segs=[(math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]),i) for i in range(len(pts)-1)]
        tot=sum(s for s,_ in segs); acc=0
        for L,i in segs:
            if acc+L>=tot/2:
                r=(tot/2-acc)/L; lx=pts[i][0]+(pts[i+1][0]-pts[i][0])*r; ly=pts[i][1]+(pts[i+1][1]-pts[i][1])*r; break
            acc+=L
        lab = e['label'].split('|')
        for k,l in enumerate(lab):
            yy = ly + (k-(len(lab)-1)/2)*13 + 4
            o.append('<text x="%.1f" y="%.1f" text-anchor="middle" font-size="11" fill="#fff" stroke="#fff" stroke-width="5" stroke-linejoin="round">%s</text>' % (lx,yy,escape(l)))
            o.append('<text x="%.1f" y="%.1f" text-anchor="middle" font-size="11" fill="#222">%s</text>' % (lx,yy,escape(l)))
    o.append('</svg>')
    open('docs/diagrams/exports/%s.svg'%name,'w',encoding='utf-8').write('\n'.join(o))
    # ---------- draw.io ----------
    d = ['<mxfile host="app.diagrams.net" agent="BrewLite Task 3.1" version="24.0.0">',
         '  <diagram id="%s" name="%s">' % (name, escape(title)),
         '    <mxGraphModel dx="%d" dy="%d" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="%d" pageHeight="%d" math="0" shadow="0">' % (W,H,W,H),
         '      <root>','        <mxCell id="0"/>','        <mxCell id="1" parent="0"/>']
    for n in nodes:
        f,s,t = STY[n['kind']]
        if n['kind']=='boundary':
            st='rounded=0;whiteSpace=wrap;html=1;fillColor=none;dashed=1;strokeColor=%s;verticalAlign=%s;align=left;spacingLeft=10;fontStyle=1;fontSize=14;'%(s,'bottom' if n.get('low') else 'top')
            val=escape(n['lines'][0])
        elif n['kind']=='db':
            st='shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=10;fillColor=%s;strokeColor=%s;fontColor=%s;'%(f,s,t); val=escape(lines_html(n))
        else:
            st='rounded=1;whiteSpace=wrap;html=1;arcSize=8;fillColor=%s;strokeColor=%s;fontColor=%s;fontSize=11;%s'%(f,s,t,'dashed=1;' if n['kind']=='future' else ''); val=escape(lines_html(n))
        d.append('        <mxCell id="%s" value="%s" style="%s" vertex="1" parent="1"><mxGeometry x="%g" y="%g" width="%g" height="%g" as="geometry"/></mxCell>'%(n['id'],val,st,n['x'],n['y'],n['w'],n['h']))
    for i,e in enumerate(edges):
        pts = route(N,e)[1:-1]
        lab = escape('<br>'.join(e['label'].split('|')))
        g = '<mxGeometry relative="1" as="geometry">' + ('<Array as="points">'+''.join('<mxPoint x="%.0f" y="%.0f"/>'%p for p in pts)+'</Array>' if pts else '') + '</mxGeometry>'
        d.append('        <mxCell id="e%d" value="%s" style="endArrow=block;endFill=1;html=1;rounded=0;strokeColor=#444444;fontSize=11;labelBackgroundColor=#ffffff;" edge="1" parent="1" source="%s" target="%s">%s</mxCell>'%(i+1,lab,e['s'],e['t'],g))
    d += ['      </root>','    </mxGraphModel>','  </diagram>','</mxfile>']
    open('docs/diagrams/sources/%s.drawio'%name,'w',encoding='utf-8').write('\n'.join(d)+'\n')

def nd(id,kind,x,y,w,h,*lines): return dict(id=id,kind=kind,x=x,y=y,w=w,h=h,lines=list(lines))
def ed(s,t,label,**k): return dict(s=s,t=t,label=label,**k)

# ================= C4 Context =================
nodes=[
 nd('cust','person',40,250,210,90,'Khách hàng','[Person]','Xem menu, đặt đơn, thanh toán,','theo dõi / hủy đơn'),
 nd('staff','person',385,30,230,90,'Nhân viên quầy','[Person]','Tiếp nhận, pha chế, cập nhật','trạng thái, hủy đơn PAID'),
 nd('mgr','person',730,30,220,90,'Quản lý cửa hàng','[Person]','Quản lý menu, nguyên liệu,','phân quyền, vận hành'),
 nd('sys','system',370,235,260,120,'BrewLite','[Software System]','Web mobile-first/PWA + REST API','+ PostgreSQL: menu, giỏ, đơn,','thanh toán, kho, điểm'),
 nd('vnp','external',740,450,230,100,'VNPay Sandbox','[External System]','Cổng thanh toán thử nghiệm','(ngoài ranh giới BrewLite)'),
]
edges=[
 ed('cust','sys','Dùng qua|trình duyệt|(HTTPS)'),
 ed('staff','sys','Quản lý đơn (HTTPS)'),
 ed('mgr','sys','Quản trị (HTTPS)'),
 ed('sys','vnp','Tạo URL thanh toán đã ký;|truy vấn giao dịch (querydr)',bend=40),
 ed('vnp','sys','IPN: thông báo kết quả|server-to-server (HMAC)',bend=40),
 ed('cust','vnp','Redirect trình duyệt: nhập thẻ/ngân hàng|rồi quay về Return URL',via=[(140,500)]),
]
build('c4-context',1000,600,nodes,edges,'C4 Level 1 – System Context – BrewLite')

# ================= C4 Container =================
nodes=[
 nd('cust','person',60,20,200,80,'Khách hàng','[Person]'),
 nd('staff','person',380,20,200,80,'Nhân viên quầy','[Person]'),
 nd('mgr','person',700,20,200,80,'Quản lý cửa hàng','[Person]'),
 dict(nd('b','boundary',20,150,940,340,'BrewLite (hệ thống đang xây dựng)'),low=True),
 nd('web','container',40,220,230,120,'Web App (Next.js)','[Container: Next.js, PWA]','Mobile-first UI: menu, giỏ hàng,','đơn, trang kết quả (Return URL)','Chạy trên trình duyệt người dùng'),
 nd('api','container',390,220,250,120,'API (NestJS)','[Container: NestJS, Node.js]','Modular monolith: Auth, Product,','Cart, Order, Payment, Inventory,','Loyalty + Scheduler'),
 nd('db','db',770,215,170,130,'PostgreSQL','[Container: DB]','Order, Payment, Ingredient,','LoyaltyTransaction, refund cũ;','migration bằng Prisma'),
 nd('vnp','external',390,570,250,90,'VNPay Sandbox','[External System]','Cổng thanh toán thử nghiệm'),
]
edges=[
 ed('cust','web','Dùng (HTTPS)'),
 ed('staff','web',''),
 ed('mgr','web',''),
 ed('web','api','REST/JSON + JWT|(HTTPS)'),
 ed('api','db','Prisma|TCP 5432 (nội bộ)'),
 ed('api','vnp','URL ký HMAC; querydr',bend=80),
 ed('vnp','api','IPN (HMAC)',bend=80),
 ed('web','vnp','Redirect trình duyệt|sang cổng thanh toán',via=[(155,615)]),
]
build('c4-container',1000,700,nodes,edges,'C4 Level 2 – Container – BrewLite')

# ================= Component (NestJS API) =================
# Chiều mũi tên = "phụ thuộc / gọi tới" (khớp bảng phụ thuộc ở architecture.md mục 5.2)
nodes=[
 nd('web','container',580,15,240,60,'Web App (Next.js)','HTTPS, REST/JSON + JWT'),
 nd('b','boundary',20,100,880,650,'API (NestJS) – kiến trúc phân lớp, chia module theo domain'),
 nd('cc','bar',40,130,840,60,'Cross-cutting (Common/Config)','ConfigModule (validate env, secret) · Pino logger + correlation-id · ValidationPipe ·','ExceptionFilter · JwtAuthGuard + RolesGuard · HealthModule (/health, /health/ready)'),
 nd('auth','component',40,225,170,80,'AuthModule','đăng ký/đăng nhập, JWT,','RBAC 3 vai trò'),
 nd('prod','component',265,225,170,80,'ProductModule','Product, ProductOption,','Recipe, RecipeIngredient'),
 nd('cart','component',490,225,170,80,'CartModule','Cart/CartItem, giá tạm tính,','báo giá server'),
 nd('promo','future',715,225,170,80,'PromotionModule «future»','chưa thuộc MVP','(không có FR trong SRS)'),
 nd('order','component',250,380,250,90,'OrderModule','Order/OrderItem, state machine,','OrderCancellation; điều phối TX1/TX3'),
 nd('pay','component',650,380,230,90,'PaymentModule','VNPayGateway, Payment attempt,','IPN, VNPayRefundRecord, QueryDR'),
 nd('inv','component',40,550,220,80,'InventoryModule','Ingredient.quantityOnHand,','OrderIngredientUsage (trừ/hoàn)'),
 nd('loy','component',290,550,220,80,'LoyaltyModule','LoyaltyTransaction (ledger),','pointsBalance, bù điểm VNPay'),
 nd('sched','component',650,550,230,80,'SchedulerModule','tự hủy đơn chưa trả hết hạn,','QueryDR attempt PENDING/UNKNOWN'),
 nd('dal','bar',40,675,820,55,'Persistence','PrismaService (Prisma Client) · prisma migrate · seed','Transaction + SELECT … FOR UPDATE (TX1 / TX2 / TX3)'),
 nd('db','db',330,785,260,80,'PostgreSQL','[Container: DB]'),
 nd('vnp','external',1000,375,200,100,'VNPay Sandbox','[External System]'),
]
edges=[
 ed('web','cc','REST/JSON + JWT'),
 ed('order','cart','báo giá|từ giỏ'),
 ed('order','prod','giá,|công thức'),
 ed('cart','prod','giá|sản phẩm'),
 ed('prod','inv','đọc Ingredient|(công thức)',via=[(170,340),(150,500)]),
 ed('pay','order','TX2: PAID /|PAYMENT_FAILED /|PAYMENT_EXCEPTION'),
 ed('sched','order','tự hủy|(chưa PAID)'),
 ed('sched','pay','QueryDR|đối soát'),
 ed('order','inv','trừ / hoàn kho|(TX2 / TX3)'),
 ed('order','loy','REDEEM / EARN / hoàn / bù|(TX1–TX3)'),
 ed('inv','dal',''),
 ed('loy','dal',''),
 ed('dal','db','SQL (TCP 5432)'),
 ed('pay','vnp','URL ký HMAC;|QueryDR',bend=45),
 ed('vnp','pay','IPN (HMAC)',bend=45),
]
build('component-api',1250,900,nodes,edges,'C4 Level 3 – Component – NestJS API')
print('Đã tạo lại 3 sơ đồ C4 (.drawio trong sources/, .svg trong exports/).')
