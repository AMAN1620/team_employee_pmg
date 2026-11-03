// The person's own to-do list, separate from their goal tasks (see components/goals/TodoBoard.tsx).
import { requirePerson } from "@/lib/session";
import { listPeople } from "@/lib/repo";
import { today } from "@/lib/time";
import { TodoBoard } from "@/components/goals/TodoBoard";

export default async function TodosPage() {
  const me = await requirePerson();
  const people = listPeople().filter((p) => p.id !== me.id).map((p) => ({ id: p.id, name: p.name, title: p.title }));
  return <TodoBoard me={me.id} people={people} today={today()} />;
}
