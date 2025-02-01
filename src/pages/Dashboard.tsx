import React from 'react';
import { useAuthStore } from '../store/authStore';
import ProfessorDashboard from './DashboardTeacher';
import AlunoDashboard from './DashboardAluno';

export default function Dashboard() {
  const { user, signOut } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Sistema de Treinos de Natação</h1>
            </div>
            <div className="flex items-center">
              <span className="mr-4">Olá, {user?.name}</span>
              <button
                onClick={signOut}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {user?.role === 'professor' ? (
          <div>
            {<ProfessorDashboard/>}
          </div>
        ) : (
          <div>
            {<AlunoDashboard/>}
          </div>
        )}
      </main>
    </div>
  );
}
