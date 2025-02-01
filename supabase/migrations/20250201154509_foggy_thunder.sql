/*
  # Schema inicial do aplicativo de natação

  1. Novas Tabelas
    - `profiles`
      - Armazena informações dos usuários (professores e alunos)
      - Vinculado à tabela auth.users do Supabase
    - `trainings`
      - Armazena os treinos cadastrados pelos professores
    - `attendances`
      - Registra a presença dos alunos nos treinos

  2. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas específicas para professores e alunos
*/

-- Criar enum para roles
CREATE TYPE user_role AS ENUM ('professor', 'aluno');

-- Tabela de perfis
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  name text NOT NULL,
  email text NOT NULL,
  role user_role NOT NULL DEFAULT 'aluno',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de treinos
CREATE TABLE trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  date timestamptz NOT NULL,
  duration integer NOT NULL, -- em minutos
  difficulty text NOT NULL CHECK (difficulty IN ('iniciante', 'intermediário', 'avançado')),
  professor_id uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de presenças
CREATE TABLE attendances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid REFERENCES trainings(id) NOT NULL,
  student_id uuid REFERENCES profiles(id) NOT NULL,
  completed_at timestamptz DEFAULT now(),
  feedback text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Usuários podem ver seus próprios perfis"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Políticas para treinos
CREATE POLICY "Professores podem criar treinos"
  ON trainings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'professor'
    )
  );

CREATE POLICY "Todos podem ver treinos"
  ON trainings
  FOR SELECT
  TO authenticated
  USING (true);

-- Políticas para presenças
CREATE POLICY "Alunos podem marcar presença"
  ON attendances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'aluno'
    )
  );

CREATE POLICY "Alunos podem ver suas presenças"
  ON attendances
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'professor'
    )
  );

-- Verificar se há perfis duplicados
SELECT id, COUNT(*) 
FROM profiles 
GROUP BY id 
HAVING COUNT(*) > 1;

-- Se encontrar duplicatas, você pode manter apenas o registro mais recente:
DELETE FROM profiles p1 USING (
  SELECT id, MAX(created_at) as max_date
  FROM profiles
  GROUP BY id
) p2
WHERE p1.id = p2.id 
AND p1.created_at < p2.max_date;

-- Adicionar uma constraint única para prevenir duplicatas futuras
ALTER TABLE profiles
ADD CONSTRAINT unique_profile_id UNIQUE (id);