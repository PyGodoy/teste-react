import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

interface Training {
  id: number;
  title: string;
  description: string;
  date: string;
  duration: number;
  difficulty: string;
  professor_id: string;
}

interface AttendanceRecord {
  id: number;
  training_id: number;
  student_id: number;
  completed_at: string;
  trainings: Training;
  profiles: {
    name: string;
  };
}

export default function ProfessorDashboard() {
  const { user } = useAuthStore();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [newTraining, setNewTraining] = useState<Partial<Training>>({
    title: '',
    description: '',
    date: '',
    duration: 0,
    difficulty: 'iniciante',
  });

  useEffect(() => {
    const fetchTrainings = async () => {
      const { data, error } = await supabase
        .from('trainings')
        .select('*')
        .eq('professor_id', user?.id);

      if (error) {
        console.error('Erro ao buscar treinos:', error);
      } else {
        setTrainings(data as Training[]);
      }
    };

    fetchTrainings();
  }, [user]);

  useEffect(() => {
    const fetchAttendance = async () => {
      const { data, error } = await supabase
        .from('attendances')
        .select(`
          *,
          trainings!inner (
            id,
            title,
            date,
            difficulty,
            professor_id
          ),
          profiles!inner (
            name
          )
        `)
        .eq('trainings.professor_id', user?.id);
  
      if (error) {
        console.error('Erro ao buscar frequência:', error);
      } else {
        setAttendance(data as AttendanceRecord[]);
      }
    };
  
    fetchAttendance();
  }, [user]);

  const handleCreateTraining = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('trainings')
      .insert([{ ...newTraining, professor_id: user?.id }]);

    if (error) {
      console.error('Erro ao criar treino:', error);
    } else {
      if (data && data.length > 0) {
        setTrainings([...trainings, data[0] as Training]);
      }

      setNewTraining({
        title: '',
        description: '',
        date: '',
        duration: 0,
        difficulty: 'iniciante',
      });
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Área do Professor</h1>
      
      {/* Form section remains the same */}
      <form onSubmit={handleCreateTraining} className="mb-8">
        <h2 className="text-xl font-bold mb-4">Cadastrar Novo Treino</h2>
        <div className="mb-4">
          <label className="block text-gray-700">Título</label>
          <input
            type="text"
            value={newTraining.title}
            onChange={(e) => setNewTraining({ ...newTraining, title: e.target.value })}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Descrição</label>
          <textarea
            value={newTraining.description}
            onChange={(e) => setNewTraining({ ...newTraining, description: e.target.value })}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Data</label>
          <input
            type="date"
            value={newTraining.date}
            onChange={(e) => setNewTraining({ ...newTraining, date: e.target.value })}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Duração (minutos)</label>
          <input
            type="number"
            value={newTraining.duration}
            onChange={(e) => setNewTraining({ ...newTraining, duration: parseInt(e.target.value) })}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Dificuldade</label>
          <select
            value={newTraining.difficulty}
            onChange={(e) => setNewTraining({ ...newTraining, difficulty: e.target.value })}
            className="w-full p-2 border rounded"
            required
          >
            <option value="iniciante">Iniciante</option>
            <option value="intermediário">Intermediário</option>
            <option value="avançado">Avançado</option>
          </select>
        </div>
        <button type="submit" className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
          Cadastrar Treino
        </button>
      </form>

      {/* Updated Trainings List */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Treinos Cadastrados</h2>
        {trainings.map((training) => (
          <div key={training.id} className="mb-4 p-4 border rounded shadow-sm hover:shadow-md transition-shadow">
            <h3 className="font-bold text-lg">{training.title}</h3>
            <p className="text-gray-600 mb-2">{training.description}</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <p>Data: {new Date(training.date).toLocaleDateString()}</p>
              <p>Duração: {training.duration} minutos</p>
              <p>Dificuldade: {training.difficulty}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Updated Attendance Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">Frequência dos Alunos</h2>
        {attendance.map((record) => (
          <div key={record.id} className="mb-4 p-4 border rounded shadow-sm hover:shadow-md transition-shadow">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-semibold">Aluno: {record.profiles.name}</p>
                <p className="text-gray-600">Treino: {record.trainings.title}</p>
              </div>
              <div>
                <p>Data do treino: {new Date(record.trainings.date).toLocaleDateString()}</p>
                <p>Concluído em: {new Date(record.completed_at).toLocaleString()}</p>
                <p>Dificuldade: {record.trainings.difficulty}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}