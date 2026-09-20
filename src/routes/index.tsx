import { createFileRoute } from "@tanstack/react-router";
import { SalvadorScene } from "../components/salvador-scene";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <SalvadorScene />;
}
