import { redirect } from "next/navigation";

/** Entry point — send visitors to the app's home surface. */
export default function RootPage() {
  redirect("/today");
}
