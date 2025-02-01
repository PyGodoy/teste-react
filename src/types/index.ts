export interface User {
  id: string;
  email: string;
  name: string;
  role: 'professor' | 'aluno';
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