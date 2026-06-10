export interface TestSuite {
  id: number;
  project_id: number;
  parent_suite_id: number | null;
  name: string;
  description: string | null;
  display_order?: number | null;
  created_at: string;
  updated_at: string | null;
  // Client-computed, not returned by backend
  test_case_count?: number;
}

export interface TestSuiteCreate {
  name: string;
  description?: string;
  parent_suite_id?: number;
  display_order?: number | null;
}

export interface TestSuiteUpdate {
  name?: string;
  description?: string;
  parent_suite_id?: number;
  display_order?: number | null;
}

export interface TestSuiteTree extends TestSuite {
  children: TestSuiteTree[];
  level: number;
  expanded: boolean;
}
