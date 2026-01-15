import { MembersList } from "@/components/members/MembersList";

export default function PendingMembersPage() {
  return (
    <MembersList
      viewTitle="Botschafter warten auf Bestaetigung"
      initialActiveFilter="inactive"
      lockActiveFilter
      showVerifyAction
    />
  );
}
