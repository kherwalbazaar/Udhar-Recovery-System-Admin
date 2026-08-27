import { redirect } from "next/navigation";

export default function AllProductsRedirect() {
  redirect("/products");
}
