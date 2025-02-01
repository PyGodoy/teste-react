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
  const [expandedWeeks, setExpandedWeeks] = useState<string[]>([]);

  useEffect(() => {
    const fetchTrainings = async () => {
      const { data, error } = await supabase
        .from('trainings')
        .select('*')
        .order('date', { ascending: true }); // Ordenar por data

      if (error) {
        console.error('Erro ao buscar treinos:', error);
      } else {
        setTrainings(data as Training[]);
      }
    };

    fetchTrainings();
  }, []);

  // Função para agrupar treinos por semana
  const groupTrainingsByWeek = (trainings: Training[]) => {
    const grouped: Record<string, Training[]> = {};

    trainings.forEach((training) => {
      const date = new Date(training.date);
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay() + 1); // Segunda-feira da semana
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 5); // Sábado da semana

      const weekKey = `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;

      if (!grouped[weekKey]) {
        grouped[weekKey] = [];
      }
      grouped[weekKey].push(training);
    });

    return grouped;
  };

  // Agrupar treinos por semana
  const groupedTrainings = groupTrainingsByWeek(trainings);

  // Alternar a expansão de uma semana específica
  const toggleWeek = (weekKey: string) => {
    if (expandedWeeks.includes(weekKey)) {
      setExpandedWeeks(expandedWeeks.filter((key) => key !== weekKey));
    } else {
      setExpandedWeeks([...expandedWeeks, weekKey]);
    }
  };

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
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-center mb-8 text-blue-600">Área do Aluno</h1>

      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Treinos da Semana</h2>
        <div className="space-y-4">
          {Object.entries(groupedTrainings).map(([weekKey, weekTrainings]) => (
            <div key={weekKey} className="bg-white p-4 rounded-lg shadow-md">
              <button
                onClick={() => toggleWeek(weekKey)}
                className="w-full text-left flex justify-between items-center p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <span className="font-semibold text-blue-600">{weekKey}</span>
                <span>{expandedWeeks.includes(weekKey) ? '▲' : '▼'}</span>
              </button>
              {expandedWeeks.includes(weekKey) && (
                <div className="mt-4 space-y-4">
                  {weekTrainings.map((training) => (
                    <div
                      key={training.id}
                      className="p-4 border rounded-lg hover:shadow-lg transition-shadow"
                    >
                      <h3 className="text-xl font-bold text-blue-600 mb-2">{training.title}</h3>
                      <p className="text-gray-600 mb-4 whitespace-pre-line">{training.description}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
                        <div>
                          <span className="font-semibold">Data:</span> {new Date(training.date).toLocaleDateString()}
                        </div>
                        <div>
                          <span className="font-semibold">Duração:</span> {training.duration} minutos
                        </div>
                        <div>
                          <span className="font-semibold">Dificuldade:</span> {training.difficulty}
                        </div>
                      </div>
                      <button
                        onClick={() => handleCompleteTraining(training.id, training.professor_id)}
                        className="mt-4 w-full sm:w-auto bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                      >
                        Marcar como Concluído
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}