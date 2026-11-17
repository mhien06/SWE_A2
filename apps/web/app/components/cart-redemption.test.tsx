import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CartPage from "./cart-page";
const state=vi.hoisted(()=>({request:vi.fn(),push:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:state.push})}));
vi.mock("./auth-session",()=>({useAuthSession:()=>({ready:true,session:{user:{pointsBalance:1000}}})}));
vi.mock("../lib/api",()=>({apiFetch:state.request}));
afterEach(()=>{cleanup();state.request.mockReset();state.push.mockReset()});
it("allows full point redemption, shows quote before placing order and sends confirmed totals",async()=>{
 const cart={id:"cart",total:39000,items:[{id:"item",productId:"product",productName:"Coffee",productIsAvailable:true,selectedSize:"S",sizeOptionId:"s",toppingOptionIds:[],selectedToppings:[],availableSizes:[{id:"s",name:"S",additionalPrice:0}],availableToppings:[],quantity:1,unitPrice:39000,lineTotal:39000}]};
 state.request.mockImplementation(async(path:string)=>path==="/cart"?cart:path==="/loyalty"?{redemptionVndPerPoint:100}:path==="/orders/quote"?{subtotal:39000,pointsRedeemed:390,pointsDiscountAmount:39000,vnpayPayableAmount:0}:{id:"order"});
 render(<CartPage/>);await screen.findByText("Coffee");
 fireEvent.click(screen.getByRole("button",{name:"Dùng tối đa"}));
 fireEvent.click(screen.getByRole("button",{name:"Xem giá trước khi đặt"}));
 await screen.findByText("Thanh toán hoàn toàn bằng điểm");
 expect(state.request.mock.calls.some(call=>call[0]==="/orders")).toBe(false);
 fireEvent.click(screen.getByRole("button",{name:"Xác nhận và tạo đơn"}));
 await waitFor(()=>expect(state.request).toHaveBeenCalledWith("/orders",{method:"POST",body:JSON.stringify({pointsRedeemed:390,expectedSubtotal:39000,expectedPointsDiscount:39000})}));
});

it("accepts points typed manually and requests an official partial-discount quote",async()=>{
 const cart={id:"cart",total:39000,items:[{id:"item",productId:"product",productName:"Coffee",productIsAvailable:true,selectedSize:"S",sizeOptionId:"s",toppingOptionIds:[],selectedToppings:[],availableSizes:[{id:"s",name:"S",additionalPrice:0}],availableToppings:[],quantity:1,unitPrice:39000,lineTotal:39000}]};
 state.request.mockImplementation(async(path:string,init?:RequestInit)=>{
  if(path==="/cart")return cart;if(path==="/loyalty")return {redemptionVndPerPoint:100};
  if(path==="/orders/quote"){const body=JSON.parse(String(init?.body));return {subtotal:39000,pointsRedeemed:body.pointsRedeemed,pointsDiscountAmount:body.pointsRedeemed*100,vnpayPayableAmount:39000-body.pointsRedeemed*100};}
  return {id:"order"};
 });
 render(<CartPage/>);await screen.findByText("Coffee");
 fireEvent.change(screen.getByRole("spinbutton",{name:/Điểm sử dụng/}),{target:{value:"120"}});
 fireEvent.click(screen.getByRole("button",{name:"Xem giá chính thức"}));
 expect(await screen.findByText("27.000đ")).toBeInTheDocument();
 expect(state.request).toHaveBeenCalledWith("/orders/quote",{method:"POST",body:JSON.stringify({pointsRedeemed:120})});
});
