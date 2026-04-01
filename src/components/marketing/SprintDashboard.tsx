import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, Zap, CheckCircle2, Clock } from "lucide-react";
import { MarketingSprint } from "@/hooks/use-sprints";
import { MarketingTask } from "@/hooks/use-marketing";
import { format, differenceInDays, differenceInCalendarDays } from "date-fns";

interface Props {
  sprint: MarketingSprint;
  tasks: MarketingTask[];
}

export function SprintDashboard({ sprint, tasks }: Props) {
  const stats = useMemo(() => {
    const sprintTasks = tasks.filter((t) => (t as any).sprint_id === sprint.id);
    const totalPoints = sprintTasks.reduce((sum, t) => sum + ((t as any).story_points || 0), 0);
    const completedTasks = sprintTasks.filter((t) => t.progress === "Concluído");
    const completedPoints = completedTasks.reduce((sum, t) => sum + ((t as any).story_points || 0), 0);
    const totalTaskCount = sprintTasks.length;
    const completedTaskCount = completedTasks.length;

    const startDate = new Date(sprint.start_date);
    const endDate = new Date(sprint.end_date);
    const now = new Date();
    const totalDays = Math.max(1, differenceInCalendarDays(endDate, startDate));
    const elapsedDays = Math.max(0, Math.min(totalDays, differenceInCalendarDays(now, startDate)));
    const remainingDays = Math.max(0, differenceInCalendarDays(endDate, now));
    const timeProgress = Math.round((elapsedDays / totalDays) * 100);

    const pointsProgress = sprint.sprint_points_goal > 0
      ? Math.round((completedPoints / sprint.sprint_points_goal) * 100)
      : totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

    // Simple burndown: ideal line vs actual
    const idealPointsRemaining = sprint.sprint_points_goal > 0
      ? Math.max(0, sprint.sprint_points_goal - (sprint.sprint_points_goal * elapsedDays / totalDays))
      : Math.max(0, totalPoints - (totalPoints * elapsedDays / totalDays));
    const actualPointsRemaining = (sprint.sprint_points_goal || totalPoints) - completedPoints;

    return {
      totalPoints,
      completedPoints,
      totalTaskCount,
      completedTaskCount,
      remainingDays,
      timeProgress,
      pointsProgress,
      idealPointsRemaining: Math.round(idealPointsRemaining),
      actualPointsRemaining: Math.max(0, actualPointsRemaining),
      goal: sprint.sprint_points_goal,
    };
  }, [sprint, tasks]);

  const isAheadOfSchedule = stats.actualPointsRemaining <= stats.idealPointsRemaining;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Target className="h-3.5 w-3.5" />
            Pontos
          </div>
          <div className="text-lg font-bold">
            {stats.completedPoints}
            <span className="text-sm font-normal text-muted-foreground">
              /{stats.goal || stats.totalPoints}
            </span>
          </div>
          <Progress value={stats.pointsProgress} className="h-1.5 mt-1" />
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-green-500">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Tarefas
          </div>
          <div className="text-lg font-bold">
            {stats.completedTaskCount}
            <span className="text-sm font-normal text-muted-foreground">
              /{stats.totalTaskCount}
            </span>
          </div>
          <Progress
            value={stats.totalTaskCount > 0 ? (stats.completedTaskCount / stats.totalTaskCount) * 100 : 0}
            className="h-1.5 mt-1"
          />
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-amber-500">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Clock className="h-3.5 w-3.5" />
            Tempo
          </div>
          <div className="text-lg font-bold">
            {stats.remainingDays}
            <span className="text-sm font-normal text-muted-foreground"> dias restantes</span>
          </div>
          <Progress value={stats.timeProgress} className="h-1.5 mt-1" />
        </CardContent>
      </Card>

      <Card className={`border-l-4 ${isAheadOfSchedule ? "border-l-green-500" : "border-l-destructive"}`}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Zap className="h-3.5 w-3.5" />
            Burndown
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-lg font-bold">{stats.actualPointsRemaining}</div>
            <span className="text-xs text-muted-foreground">pts restantes</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            Ideal: {stats.idealPointsRemaining} pts •{" "}
            <span className={isAheadOfSchedule ? "text-green-600" : "text-destructive"}>
              {isAheadOfSchedule ? "No ritmo ✓" : "Atrasado ⚠"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
