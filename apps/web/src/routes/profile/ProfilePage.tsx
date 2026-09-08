import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { authService } from '@/services/auth.service';

export function ProfilePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authService.me(),
  });

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your account details.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {isLoading && <p className="text-muted-foreground">Loading...</p>}
        {isError && (
          <p className="text-destructive">Unable to load your profile.</p>
        )}
        {data && (
          <>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{data.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Member since</p>
              <p className="font-medium">
                {new Date(data.createdAt).toLocaleDateString('en-US')}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
