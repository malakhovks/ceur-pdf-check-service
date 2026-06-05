import { redirect } from "next/navigation";
import { auth } from "../auth";
import CheckerUi from "./checker-ui";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  return <CheckerUi user={session.user} />;
}
