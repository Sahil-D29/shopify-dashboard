"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Award, PlusCircle, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type { Goal } from "@/lib/types/experiment-config";

import { AddGoalModal } from "./AddGoalModal";

interface GoalSelectorProps {
  goals: Goal[];
  primaryGoalId: string;
  onChange: (goals: Goal[], primaryGoalId: string) => void;
}

export function GoalSelector({ goals, primaryGoalId, onChange }: GoalSelectorProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const primaryGoal = useMemo(() => goals.find(goal => goal.id === primaryGoalId), [goals, primaryGoalId]);

  const handleAddGoal = (goal: Goal) => {
    const nextGoals = [...goals, goal];
    const nextPrimary = primaryGoalId || goal.id;
    onChange(nextGoals, nextPrimary);
  };

  const handleDeleteGoal = (goalId: string) => {
    const nextGoals = goals.filter(goal => goal.id !== goalId);
    let nextPrimary = primaryGoalId;
    if (primaryGoalId === goalId) {
      nextPrimary = nextGoals[0]?.id ?? "";
    }
    onChange(nextGoals, nextPrimary);
  };

  const handleSetPrimary = (goalId: string) => {
    onChange(goals, goalId);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#1E293B]">Goals</h3>
          <p className="text-xs text-[#64748B]">Track outcomes to judge winning variants. At least one goal required.</p>
        </div>
        <Button type="button" size="sm" onClick={() => setModalOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#CBD5F5] bg-[#EEF2FF] px-4 py-5 text-sm text-[#312E81]">
          No goals added yet. Add at least one goal to measure experiment success.
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(goal => (
            <div key={goal.id} className={cn("rounded-2xl border border-[#E2E8F0] bg-white px-4 py-4", primaryGoalId === goal.id && "border-[#34D399]")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#1E293B]">{goal.name}</p>
                    {goal.id === primaryGoalId ? (
                      <Badge className="bg-[#D1FAE5] text-[#047857]">
                        <Award className="mr-1 h-3 w-3" />
                        Primary
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-[#F8FAFC] text-[#475569]">
                        Secondary
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B]">
                    Type: {goal.type.replace(/_/g, " ")}
                    {goal.eventName ? ` • Event: ${goal.eventName}` : ""}
                  </p>
                  <p className="text-xs text-[#94A3B8]">
                    Attribution window: {goal.attributionWindow.value} {goal.attributionWindow.unit}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {goal.id === primaryGoalId ? null : (
                    <Button variant="outline" size="sm" onClick={() => handleSetPrimary(goal.id)}>
                      Set as primary
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-[#94A3B8] hover:text-red-500"
                    onClick={() => handleDeleteGoal(goal.id)}
                    disabled={goals.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {goal.notes ? (
                <>
                  <Separator className="my-3" />
                  <p className="text-xs text-[#475569]">{goal.notes}</p>
                </>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {goals.length === 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-[#FDE68A] bg-[#FEF3C7] px-3 py-2 text-xs text-[#92400E]">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          Add at least one goal before launching the experiment.
        </div>
      ) : null}

      <AddGoalModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleAddGoal} />
    </section>
  );
}



