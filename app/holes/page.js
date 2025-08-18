import { redirect } from "next/navigation";

export default function HolesRedirectPage() {
  // This route has been retired; redirect to core view
  redirect("/core");
}
