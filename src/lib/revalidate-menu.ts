import { revalidatePath } from "next/cache";

/** Call after any menu catalog write so the public Home/Menu pages pick up the change immediately. */
export function revalidateMenuPages() {
  revalidatePath("/");
  revalidatePath("/menu");
}
