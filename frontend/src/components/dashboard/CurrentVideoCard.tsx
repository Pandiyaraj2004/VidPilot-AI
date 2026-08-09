import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROUTES } from "@/constants/routes";
import { Film } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function CurrentVideoCard() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Video</CardTitle>
      </CardHeader>
      <CardContent>
        <EmptyState
          icon={Film}
          title="No videos yet."
          description="Create your first AI video and it will appear here."
          action={
            <Button size="sm" onClick={() => navigate(ROUTES.create)}>
              Create Video
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}
