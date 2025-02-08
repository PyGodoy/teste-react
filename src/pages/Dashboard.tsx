import React from 'react';
import { useAuthStore } from '../store/authStore';
import ProfessorDashboard from './DashboardTeacher';
import AlunoDashboard from './DashboardAluno';
import UserAvatar from './UserAvatar';

export default function Dashboard() {
  const { user, signOut, updateUser } = useAuthStore();

  // Tratamento para caso o user seja null
  if (!user) {
    return null; // ou um componente de loading/erro
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="h-10 w-10 mr-2"
                onError={(e) => {
                  // Tratamento para erro no carregamento do logo
                  e.currentTarget.src = '/fallback-logo.png'; // ou alguma outra imagem de fallback
                }}
              />
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
              <UserAvatar 
                user={user}
                className="mr-2"
                onAvatarUpdate={(url) => {
                  if (updateUser) {
                    updateUser({ avatar_url: url })
                      .catch(error => {
                        console.error('Erro ao atualizar avatar:', error);
                      });
                  }
                }}
              />
              <span className="truncate max-w-[150px] sm:max-w-[200px] text-ellipsis overflow-hidden">
                Olá, {user.name.split(' ')[0]} {/* Exibe apenas o primeiro nome */}
              </span>
              </div>
              <button
                onClick={signOut}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto sm:px-6 lg:px-8 mt-0">
        {user.role === 'professor' ? (
          <ProfessorDashboard />
        ) : (
          <AlunoDashboard />
        )}
      </main>
    </div>
  );
}