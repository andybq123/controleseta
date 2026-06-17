export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      allowed_emails: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          nome: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      email_inbox_accounts: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          email: string
          id: string
          imap_host: string | null
          imap_password: string | null
          imap_port: number | null
          imap_tls: boolean | null
          imap_user: string | null
          provider: string
          secretaria_id: string | null
          token: string
          ultima_sincronizacao: string | null
          ultima_sync_erros: number
          ultima_sync_novos: number
          ultima_sync_processados: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          email: string
          id?: string
          imap_host?: string | null
          imap_password?: string | null
          imap_port?: number | null
          imap_tls?: boolean | null
          imap_user?: string | null
          provider?: string
          secretaria_id?: string | null
          token?: string
          ultima_sincronizacao?: string | null
          ultima_sync_erros?: number
          ultima_sync_novos?: number
          ultima_sync_processados?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          email?: string
          id?: string
          imap_host?: string | null
          imap_password?: string | null
          imap_port?: number | null
          imap_tls?: boolean | null
          imap_user?: string | null
          provider?: string
          secretaria_id?: string | null
          token?: string
          ultima_sincronizacao?: string | null
          ultima_sync_erros?: number
          ultima_sync_novos?: number
          ultima_sync_processados?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_inbox_accounts_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
        ]
      }
      email_inbox_log: {
        Row: {
          account_id: string | null
          assunto: string | null
          corpo: string | null
          destinatario: string | null
          erro: string | null
          external_id: string | null
          id: string
          processado_em: string | null
          protocolo_id: string | null
          recebido_em: string
          remetente: string | null
          status: string
        }
        Insert: {
          account_id?: string | null
          assunto?: string | null
          corpo?: string | null
          destinatario?: string | null
          erro?: string | null
          external_id?: string | null
          id?: string
          processado_em?: string | null
          protocolo_id?: string | null
          recebido_em?: string
          remetente?: string | null
          status?: string
        }
        Update: {
          account_id?: string | null
          assunto?: string | null
          corpo?: string | null
          destinatario?: string | null
          erro?: string | null
          external_id?: string | null
          id?: string
          processado_em?: string | null
          protocolo_id?: string | null
          recebido_em?: string
          remetente?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_inbox_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_inbox_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_inbox_log_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos"
            referencedColumns: ["id"]
          },
        ]
      }
      locais: {
        Row: {
          centro_custo: string | null
          created_at: string
          id: string
          nome: string
          secretaria_id: string
          updated_at: string
        }
        Insert: {
          centro_custo?: string | null
          created_at?: string
          id?: string
          nome: string
          secretaria_id: string
          updated_at?: string
        }
        Update: {
          centro_custo?: string | null
          created_at?: string
          id?: string
          nome?: string
          secretaria_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locais_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      protocolo_historico: {
        Row: {
          acao: string
          autor_id: string | null
          autor_nome: string | null
          campo: string
          created_at: string
          id: string
          protocolo_id: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          acao?: string
          autor_id?: string | null
          autor_nome?: string | null
          campo: string
          created_at?: string
          id?: string
          protocolo_id: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          acao?: string
          autor_id?: string | null
          autor_nome?: string | null
          campo?: string
          created_at?: string
          id?: string
          protocolo_id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "protocolo_historico_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos"
            referencedColumns: ["id"]
          },
        ]
      }
      protocolos: {
        Row: {
          assunto: string
          categoria: Database["public"]["Enums"]["protocolo_categoria"]
          contato_solicitante: string | null
          created_at: string
          created_by: string | null
          data_abertura: string
          data_conclusao: string | null
          data_prorrogacao: string | null
          descricao: string | null
          endereco: string | null
          hash_consulta: string | null
          id: string
          latitude: number | null
          local_id: string | null
          longitude: number | null
          numero: string
          origem: string | null
          prorrogado: boolean
          responsavel_id: string | null
          secretaria_id: string | null
          sigilo: string
          solicitante: string | null
          status: Database["public"]["Enums"]["protocolo_status"]
          tipo: Database["public"]["Enums"]["protocolo_tipo"]
          updated_at: string
        }
        Insert: {
          assunto: string
          categoria?: Database["public"]["Enums"]["protocolo_categoria"]
          contato_solicitante?: string | null
          created_at?: string
          created_by?: string | null
          data_abertura?: string
          data_conclusao?: string | null
          data_prorrogacao?: string | null
          descricao?: string | null
          endereco?: string | null
          hash_consulta?: string | null
          id?: string
          latitude?: number | null
          local_id?: string | null
          longitude?: number | null
          numero: string
          origem?: string | null
          prorrogado?: boolean
          responsavel_id?: string | null
          secretaria_id?: string | null
          sigilo?: string
          solicitante?: string | null
          status?: Database["public"]["Enums"]["protocolo_status"]
          tipo: Database["public"]["Enums"]["protocolo_tipo"]
          updated_at?: string
        }
        Update: {
          assunto?: string
          categoria?: Database["public"]["Enums"]["protocolo_categoria"]
          contato_solicitante?: string | null
          created_at?: string
          created_by?: string | null
          data_abertura?: string
          data_conclusao?: string | null
          data_prorrogacao?: string | null
          descricao?: string | null
          endereco?: string | null
          hash_consulta?: string | null
          id?: string
          latitude?: number | null
          local_id?: string | null
          longitude?: number | null
          numero?: string
          origem?: string | null
          prorrogado?: boolean
          responsavel_id?: string | null
          secretaria_id?: string | null
          sigilo?: string
          solicitante?: string | null
          status?: Database["public"]["Enums"]["protocolo_status"]
          tipo?: Database["public"]["Enums"]["protocolo_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocolos_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolos_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
        ]
      }
      responsaveis: {
        Row: {
          cargo: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          secretaria_id: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          secretaria_id: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          secretaria_id?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsaveis_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
        ]
      }
      secretarias: {
        Row: {
          centro_custo: string | null
          created_at: string
          created_by: string | null
          endereco: string | null
          icone: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          sigla: string | null
          updated_at: string
        }
        Insert: {
          centro_custo?: string | null
          created_at?: string
          created_by?: string | null
          endereco?: string | null
          icone?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome: string
          sigla?: string | null
          updated_at?: string
        }
        Update: {
          centro_custo?: string | null
          created_at?: string
          created_by?: string | null
          endereco?: string | null
          icone?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          sigla?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consultar_protocolo_publico: {
        Args: { p_hash: string; p_numero: string }
        Returns: {
          assunto: string
          categoria: Database["public"]["Enums"]["protocolo_categoria"]
          contato_solicitante: string
          created_at: string
          data_abertura: string
          data_conclusao: string
          data_prorrogacao: string
          descricao: string
          endereco: string
          id: string
          latitude: number
          local_nome: string
          longitude: number
          numero: string
          origem: string
          prorrogado: boolean
          secretaria_nome: string
          sigilo: string
          solicitante: string
          status: Database["public"]["Enums"]["protocolo_status"]
          tipo: Database["public"]["Enums"]["protocolo_tipo"]
          updated_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      protocolo_categoria:
        | "elogio"
        | "reclamacao"
        | "pedido_informacao"
        | "denuncia"
        | "solicitacao"
        | "outros"
      protocolo_status: "aberto" | "em_andamento" | "concluido"
      protocolo_tipo: "ouvidoria" | "lai" | "esic"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      protocolo_categoria: [
        "elogio",
        "reclamacao",
        "pedido_informacao",
        "denuncia",
        "solicitacao",
        "outros",
      ],
      protocolo_status: ["aberto", "em_andamento", "concluido"],
      protocolo_tipo: ["ouvidoria", "lai", "esic"],
    },
  },
} as const
