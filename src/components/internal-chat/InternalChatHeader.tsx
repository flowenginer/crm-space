import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

interface InternalChatHeaderProps {
  otherUserId: string | null;
}

export function InternalChatHeader({ otherUserId }: InternalChatHeaderProps) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['internal-chat-user', otherUserId],
    enabled: !!otherUserId,
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, is_online, department_id')
        .eq('id', otherUserId!)
        .single();

      if (error) throw error;

      let departmentName = null;
      if (profile?.department_id) {
        const { data: dept } = await supabase
          .from('departments')
          .select('name')
          .eq('id', profile.department_id)
          .single();
        departmentName = dept?.name;
      }

      return { ...profile, department_name: departmentName };
    }
  });

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!otherUserId) return null;

  return (
    <div className="h-16 px-4 border-b border-border flex items-center gap-3 bg-card">
      {isLoading ? (
        <>
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        </>
      ) : (
        <>
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.avatar_url || ''} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(user?.full_name)}
              </AvatarFallback>
            </Avatar>
            {user?.is_online && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-card" />
            )}
          </div>
          <div>
            <h3 className="font-medium">{user?.full_name || 'Usuário'}</h3>
            <p className="text-xs text-muted-foreground">
              {user?.is_online ? 'Online' : 'Offline'}
              {user?.department_name && ` • ${user.department_name}`}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
