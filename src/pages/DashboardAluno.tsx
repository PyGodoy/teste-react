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
  professor_id: string; // UUID
}

export default function AlunoDashboard() {
  const { user } = useAuthStore();
  const [trainings, setTrainings] = useState<Training[]>([]);

  useEffect(() => {
    const fetchTrainings = async () => {
      const { data, error } = await supabase
        .from('trainings')
        .select('*');

      if (error) {
        console.error('Erro ao buscar treinos:', error);
      } else {
        setTrainings(data as Training[]);
      }
    };

    fetchTrainings();
  }, []);

  const handleCompleteTraining = async (trainingId: number, professorId: string) => {
    const { error } = await supabase
      .from('attendances')
      .insert([{
        training_id: trainingId,
        student_id: user?.id,
        professor_id: professorId,
        completed_at: new Date().toISOString()
      }]);
  
    if (error) {
      console.error('Erro ao marcar treino como concluído:', error);
    } else {
      alert('Treino marcado como concluído!');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Área do Aluno</h1>
      <div>
        <h2 className="text-xl font-bold mb-4">Treinos da Semana</h2>
        {trainings.map((training) => (
          <div key={training.id} className="mb-4 p-4 border rounded">
            <h3 className="font-bold">{training.title}</h3>
            <p>{training.description}</p>
            <p>Data: {new Date(training.date).toLocaleDateString()}</p>
            <p>Duração: {training.duration} minutos</p>
            <p>Dificuldade: {training.difficulty}</p>
            <button
              onClick={() => handleCompleteTraining(training.id, training.professor_id)}
              className="bg-green-500 text-white p-2 rounded mt-2"
            >
              Marcar como Concluído
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}