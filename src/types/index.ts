export interface User {
  id: string;
  email: string;
  name: string;
  role: 'professor' | 'aluno';
  avatar_url?: string | null;  // Aqui está com null
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: 'professor' | 'aluno';
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
  student_type: string;
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

export interface SwimmingTime {
  id: string;
  student_id: string;
  distance: '50m' | '100m' | '200m' | '400m' | '800m' | '1500m';
  style: 'Crawl' | 'Costas' | 'Peito' | 'Borboleta' | 'Medley';
  time_seconds: number;
  created_at: string;
}