import type { Metadata } from "next";
import { HomePage } from "@/components/pages/home";

export const metadata: Metadata = {
  title: "Home · Deal Discount Review",
};

export default function Page() {
  return <HomePage />;
}
