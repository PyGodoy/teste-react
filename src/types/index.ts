export interface User {
  id: string;
  email: string;
  name: string;
  role: 'professor' | 'aluno';
  is_authorized?: boolean;
}

export interface Training {
  id: string;
  title: string;
  description: string;
  date: string;
  duration: number;
  difficulty: 'iniciante' | 'intermediário' | 'avançado';
  professor_id: string;
}

export interface Attendance {
  id: string;
  training_id: string;
  student_id: string;
  completed_at: string;
  feedback?: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  role: 'aluno';
  is_authorized: boolean;
  created_at: string;
}