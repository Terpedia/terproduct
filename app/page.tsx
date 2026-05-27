import { FieldConsole } from "@/components/FieldConsole";
import { RootQueryShell } from "@/components/terpedia/RootQueryShell";

export default function Home() {
  return (
    <RootQueryShell>
      <FieldConsole />
    </RootQueryShell>
  );
}
