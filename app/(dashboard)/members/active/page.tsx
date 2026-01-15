import { MembersList } from "@/components/members/MembersList";

export default function ActiveMembersPage() {
  return (
    <MembersList
      viewTitle="Aktive Botschafter"
      initialActiveFilter="active"
      lockActiveFilter
    />
  );
}
