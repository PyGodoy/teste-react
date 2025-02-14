import { create } from 'zustand';
import { User } from '../types';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,

  updateUser: async (userData: Partial<User>) => {
    try {
      const currentUser = get().user;
      if (!currentUser) {
        throw new Error('Nenhum usuário logado');
      }

      // Atualiza o perfil no Supabase
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          ...userData,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);

      if (updateError) {
        throw new Error(`Erro ao atualizar perfil: ${updateError.message}`);
      }

      // Atualiza o estado local
      set({
        user: {
          ...currentUser,
          ...userData
        }
      });

    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      console.log('Iniciando processo de login');
      
      if (!email || !password) {
        throw new Error('Email e senha são obrigatórios');
      }
  
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
  
      if (error) {
        console.error('Erro no login Supabase:', error);
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Email ou senha incorretos');
        }
        throw error;
      }
  
      if (!data?.user) {
        console.error('Login sem usuário retornado');
        throw new Error('Usuário não encontrado');
      }
  
      console.log('Login bem-sucedido, buscando perfil para ID:', data.user.id);
      
      const { data: profiles, error: profileError, count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('id', data.user.id);
  
      if (profileError) {
        console.error('Erro ao buscar perfil:', profileError);
        throw new Error(`Erro ao buscar perfil: ${profileError.message}`);
      }
  
      if (!profiles || profiles.length === 0) {
        console.error('Nenhum perfil encontrado para o ID:', data.user.id);
        throw new Error('Perfil não encontrado. Por favor, contate o suporte.');
      }
  
      const profile = profiles[0];
  
      if (email.trim() === 'clubeapanat@gmail.com') {
        console.log('Email do professor detectado, definindo role como professor');
        profile.role = 'professor';
      }
  
      console.log('Perfil encontrado:', profile);
      
      set({ 
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
          avatar_url: profile.avatar_url
        }
      });
  
      console.log('Login completado com sucesso');
    } catch (error) {
      console.error('Erro completo no login:', error);
      throw error;
    }
  },

  signUp: async (email: string, password: string, name: string) => {
    try {
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });
  
      if (signUpError) throw signUpError;
      if (!user) throw new Error('Erro ao criar usuário');
  
      console.log('Usuário criado, verificando perfil existente para ID:', user.id);
  
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id);
  
      if (existingProfile && existingProfile.length > 0) {
        console.log('Perfil já existe, não é necessário criar outro');
        return;
      }
  
      console.log('Criando novo perfil');
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: user.id,
            email: email.trim(),
            name: name.trim(),
            role: 'aluno',
            avatar_url: null
          }
        ]);
  
      if (profileError) {
        console.error('Erro ao criar perfil:', profileError);
        throw new Error('Erro ao criar perfil do usuário: ' + profileError.message);
      }
  
      console.log('Perfil criado com sucesso');
    } catch (error) {
      console.error('Erro completo no cadastro:', error);
      throw error;
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },

  initialize: async () => {
    try {
      console.log('Iniciando verificação de sessão');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        console.log('Sessão encontrada, buscando perfil');
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          console.log('Perfil encontrado, atualizando estado');
          set({ 
            user: {
              id: profile.id,
              email: profile.email,
              name: profile.name,
              role: profile.role,
              avatar_url: profile.avatar_url
            }
          });
        }
      }
      
      set({ loading: false });
    } catch (error) {
      console.error('Erro na inicialização:', error);
      set({ loading: false });
    }
  },
}));
