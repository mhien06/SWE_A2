import Menu from "./components/menu";
import CustomerMenuGuard from "./components/customer-menu-guard";

export default function Home() {
  return <CustomerMenuGuard><Menu /></CustomerMenuGuard>;
}
