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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string
          household_id: string
          id: string
          is_archived: boolean | null
          name: string
          scope: string
          starting_balance: number
          starting_date: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency?: string
          household_id: string
          id?: string
          is_archived?: boolean | null
          name: string
          scope?: string
          starting_balance?: number
          starting_date?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string
          household_id?: string
          id?: string
          is_archived?: boolean | null
          name?: string
          scope?: string
          starting_balance?: number
          starting_date?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          alerts_enabled: boolean | null
          category: string
          created_at: string | null
          created_by: string | null
          emoji: string
          end_month: string | null
          household_id: string
          id: string
          is_recurring: boolean | null
          limit_amount: number
          month_year: string | null
          period: string
          scope: string
          start_month: string
          updated_at: string | null
        }
        Insert: {
          alerts_enabled?: boolean | null
          category: string
          created_at?: string | null
          created_by?: string | null
          emoji?: string
          end_month?: string | null
          household_id: string
          id?: string
          is_recurring?: boolean | null
          limit_amount: number
          month_year?: string | null
          period?: string
          scope?: string
          start_month: string
          updated_at?: string | null
        }
        Update: {
          alerts_enabled?: boolean | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          emoji?: string
          end_month?: string | null
          household_id?: string
          id?: string
          is_recurring?: boolean | null
          limit_amount?: number
          month_year?: string | null
          period?: string
          scope?: string
          start_month?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          emoji: string
          household_id: string | null
          id: string
          is_default: boolean | null
          name: string
          scope: string
          type: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          household_id?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          scope?: string
          type: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          household_id?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          scope?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_payment_overrides: {
        Row: {
          created_at: string | null
          custom_interest: number
          custom_principal: number
          debt_id: string
          household_id: string
          id: string
          payment_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_interest: number
          custom_principal: number
          debt_id: string
          household_id: string
          id?: string
          payment_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_interest?: number
          custom_principal?: number
          debt_id?: string
          household_id?: string
          id?: string
          payment_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_payment_overrides_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payment_overrides_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_schedules: {
        Row: {
          capital_after: number
          capital_before: number
          created_at: string | null
          debt_id: string
          due_date: string
          household_id: string
          id: string
          interest_amount: number
          period_number: number
          principal_amount: number
          status: string
          total_amount: number
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          capital_after: number
          capital_before: number
          created_at?: string | null
          debt_id: string
          due_date: string
          household_id: string
          id?: string
          interest_amount: number
          period_number: number
          principal_amount: number
          status?: string
          total_amount: number
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          capital_after?: number
          capital_before?: number
          created_at?: string | null
          debt_id?: string
          due_date?: string
          household_id?: string
          id?: string
          interest_amount?: number
          period_number?: number
          principal_amount?: number
          status?: string
          total_amount?: number
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_schedules_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_schedules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_schedules_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          account_id: string | null
          amortization_type: string
          annual_amortization: number | null
          annual_km: number | null
          category_id: string | null
          consumer_type: string | null
          contract_end_date: string | null
          created_at: string | null
          created_by: string | null
          credit_limit: number | null
          currency: string
          current_balance: number | null
          current_km: number | null
          deferral_end_date: string | null
          deferral_type: string | null
          down_payment: number | null
          duration_years: number
          excess_km_cost: number | null
          has_deferral: boolean | null
          has_interest: boolean | null
          has_schedule: boolean | null
          household_id: string
          id: string
          include_maintenance: boolean | null
          initial_amount: number
          interest_rate: number
          last_payment_date: string | null
          lender: string | null
          minimum_payment: number | null
          mortgage_system: string | null
          name: string
          next_payment_date: string | null
          notes: string | null
          payment_amount: number
          payment_day: number
          payment_frequency: string
          property_value: number | null
          purchase_price: number | null
          rate_end_date: string | null
          rate_type: string
          remaining_amount: number
          residual_value: number | null
          scope: string
          services_included: string[] | null
          start_date: string
          swiss_amortization_type: string | null
          type: string
          updated_at: string | null
          vehicle_name: string | null
          vehicle_price: number | null
          vehicle_type: string | null
        }
        Insert: {
          account_id?: string | null
          amortization_type?: string
          annual_amortization?: number | null
          annual_km?: number | null
          category_id?: string | null
          consumer_type?: string | null
          contract_end_date?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          currency?: string
          current_balance?: number | null
          current_km?: number | null
          deferral_end_date?: string | null
          deferral_type?: string | null
          down_payment?: number | null
          duration_years: number
          excess_km_cost?: number | null
          has_deferral?: boolean | null
          has_interest?: boolean | null
          has_schedule?: boolean | null
          household_id: string
          id?: string
          include_maintenance?: boolean | null
          initial_amount: number
          interest_rate?: number
          last_payment_date?: string | null
          lender?: string | null
          minimum_payment?: number | null
          mortgage_system?: string | null
          name: string
          next_payment_date?: string | null
          notes?: string | null
          payment_amount: number
          payment_day?: number
          payment_frequency?: string
          property_value?: number | null
          purchase_price?: number | null
          rate_end_date?: string | null
          rate_type?: string
          remaining_amount: number
          residual_value?: number | null
          scope?: string
          services_included?: string[] | null
          start_date: string
          swiss_amortization_type?: string | null
          type: string
          updated_at?: string | null
          vehicle_name?: string | null
          vehicle_price?: number | null
          vehicle_type?: string | null
        }
        Update: {
          account_id?: string | null
          amortization_type?: string
          annual_amortization?: number | null
          annual_km?: number | null
          category_id?: string | null
          consumer_type?: string | null
          contract_end_date?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          currency?: string
          current_balance?: number | null
          current_km?: number | null
          deferral_end_date?: string | null
          deferral_type?: string | null
          down_payment?: number | null
          duration_years?: number
          excess_km_cost?: number | null
          has_deferral?: boolean | null
          has_interest?: boolean | null
          has_schedule?: boolean | null
          household_id?: string
          id?: string
          include_maintenance?: boolean | null
          initial_amount?: number
          interest_rate?: number
          last_payment_date?: string | null
          lender?: string | null
          minimum_payment?: number | null
          mortgage_system?: string | null
          name?: string
          next_payment_date?: string | null
          notes?: string | null
          payment_amount?: number
          payment_day?: number
          payment_frequency?: string
          property_value?: number | null
          purchase_price?: number | null
          rate_end_date?: string | null
          rate_type?: string
          remaining_amount?: number
          residual_value?: number | null
          scope?: string
          services_included?: string[] | null
          start_date?: string
          swiss_amortization_type?: string | null
          type?: string
          updated_at?: string | null
          vehicle_name?: string | null
          vehicle_price?: number | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          base_currency: string
          id: string
          rate: number
          target_currency: string
          updated_at: string | null
        }
        Insert: {
          base_currency: string
          id?: string
          rate: number
          target_currency: string
          updated_at?: string | null
        }
        Update: {
          base_currency?: string
          id?: string
          rate?: number
          target_currency?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      health_scores: {
        Row: {
          budget_compliance_score: number | null
          budgets_respected_percent: number | null
          created_at: string | null
          debt_service_ratio: number | null
          debt_service_score: number | null
          debt_to_income_ratio: number | null
          debt_to_income_score: number | null
          emergency_fund_months: number | null
          emergency_fund_score: number | null
          household_id: string
          id: string
          month_year: string
          progression_score: number | null
          savings_rate_percent: number | null
          savings_rate_score: number | null
          total_score: number
        }
        Insert: {
          budget_compliance_score?: number | null
          budgets_respected_percent?: number | null
          created_at?: string | null
          debt_service_ratio?: number | null
          debt_service_score?: number | null
          debt_to_income_ratio?: number | null
          debt_to_income_score?: number | null
          emergency_fund_months?: number | null
          emergency_fund_score?: number | null
          household_id: string
          id?: string
          month_year: string
          progression_score?: number | null
          savings_rate_percent?: number | null
          savings_rate_score?: number | null
          total_score: number
        }
        Update: {
          budget_compliance_score?: number | null
          budgets_respected_percent?: number | null
          created_at?: string | null
          debt_service_ratio?: number | null
          debt_service_score?: number | null
          debt_to_income_ratio?: number | null
          debt_to_income_score?: number | null
          emergency_fund_months?: number | null
          emergency_fund_score?: number | null
          household_id?: string
          id?: string
          month_year?: string
          progression_score?: number | null
          savings_rate_percent?: number | null
          savings_rate_score?: number | null
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "health_scores_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string | null
          household_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          household_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          household_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          ai_advice_count_this_week: number
          ai_advice_last_date: string | null
          created_at: string | null
          default_currency: string | null
          id: string
          monthly_savings_target: number | null
          name: string
          plan: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_end_date: string | null
          subscription_status: string | null
          updated_at: string | null
        }
        Insert: {
          ai_advice_count_this_week?: number
          ai_advice_last_date?: string | null
          created_at?: string | null
          default_currency?: string | null
          id?: string
          monthly_savings_target?: number | null
          name: string
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_advice_count_this_week?: number
          ai_advice_last_date?: string | null
          created_at?: string | null
          default_currency?: string | null
          id?: string
          monthly_savings_target?: number | null
          name?: string
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string | null
          household_id: string
          id: string
          invited_by: string | null
          role: string | null
          status: string | null
          token: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string | null
          household_id: string
          id?: string
          invited_by?: string | null
          role?: string | null
          status?: string | null
          token?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string | null
          household_id?: string
          id?: string
          invited_by?: string | null
          role?: string | null
          status?: string | null
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string | null
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string | null
          monthly_savings_target: number | null
          onboarding_done: boolean
          plan: string
          updated_at: string | null
        }
        Insert: {
          avatar_color?: string | null
          created_at?: string | null
          email: string
          first_name: string
          id: string
          last_name?: string | null
          monthly_savings_target?: number | null
          onboarding_done?: boolean
          plan?: string
          updated_at?: string | null
        }
        Update: {
          avatar_color?: string | null
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string | null
          monthly_savings_target?: number | null
          onboarding_done?: boolean
          plan?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      savings_deposits: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          goal_id: string
          household_id: string
          id: string
          member_id: string | null
          notes: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          date: string
          goal_id: string
          household_id: string
          id?: string
          member_id?: string | null
          notes?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string
          goal_id?: string
          household_id?: string
          id?: string
          member_id?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_deposits_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_deposits_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string
          emoji: string
          household_id: string
          id: string
          name: string
          scope: string
          target_amount: number
          target_date: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency?: string
          emoji: string
          household_id: string
          id?: string
          name: string
          scope?: string
          target_amount: number
          target_date?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string
          emoji?: string
          household_id?: string
          id?: string
          name?: string
          scope?: string
          target_amount?: number
          target_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          base_currency: string
          category: string
          converted_amount: number
          created_at: string | null
          created_by: string | null
          currency: string
          date: string
          debt_id: string | null
          debt_payment_type: string | null
          emoji: string
          exchange_rate: number
          household_id: string
          id: string
          is_auto_generated: boolean | null
          is_recurring: boolean | null
          label: string
          member_id: string | null
          notes: string | null
          recurrence_day: number | null
          recurring_end_month: string | null
          recurring_source_id: string | null
          recurring_start_month: string | null
          scope: string
          type: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          base_currency: string
          category: string
          converted_amount: number
          created_at?: string | null
          created_by?: string | null
          currency: string
          date: string
          debt_id?: string | null
          debt_payment_type?: string | null
          emoji?: string
          exchange_rate?: number
          household_id: string
          id?: string
          is_auto_generated?: boolean | null
          is_recurring?: boolean | null
          label: string
          member_id?: string | null
          notes?: string | null
          recurrence_day?: number | null
          recurring_end_month?: string | null
          recurring_source_id?: string | null
          recurring_start_month?: string | null
          scope?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          base_currency?: string
          category?: string
          converted_amount?: number
          created_at?: string | null
          created_by?: string | null
          currency?: string
          date?: string
          debt_id?: string | null
          debt_payment_type?: string | null
          emoji?: string
          exchange_rate?: number
          household_id?: string
          id?: string
          is_auto_generated?: boolean | null
          is_recurring?: boolean | null
          label?: string
          member_id?: string | null
          notes?: string | null
          recurrence_day?: number | null
          recurring_end_month?: string | null
          recurring_source_id?: string | null
          recurring_start_month?: string | null
          scope?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_source_id_fkey"
            columns: ["recurring_source_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { _invitation_id: string }
        Returns: undefined
      }
      decline_invitation: {
        Args: { _currency?: string; _invitation_id: string }
        Returns: undefined
      }
      get_household_role: {
        Args: { _household_id: string; _user_id: string }
        Returns: string
      }
      get_user_household_id: { Args: { _user_id: string }; Returns: string }
      is_household_member: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      remove_member_from_household: {
        Args: { _household_id: string; _user_id: string }
        Returns: undefined
      }
      validate_invitation_token: { Args: { _token: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
