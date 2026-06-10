export interface Milestone {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  target_date: string | null;
  is_completed: boolean;
  created_at: string;
}

export interface MilestoneCreate {
  name: string;
  description?: string;
  target_date?: string;
}

export interface MilestoneUpdate {
  name?: string;
  description?: string;
  target_date?: string;
  is_completed?: boolean;
}
