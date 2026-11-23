/** JSON values stored in the billing tables' jsonb columns. */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type BillingInterval = "monthly" | "annual";
export type SubscriptionStatus =
  | "pending"
  | "active"
  | "non_renewing"
  | "past_due"
  | "cancelled"
  | "expired"
  | "failed";
export type PaymentStatus = "pending" | "success" | "failed" | "abandoned" | "reversed";

/**
 * The billing tables defined by the NJS billing migrations.
 * This intentionally describes the schema used by the billing Worker client,
 * rather than replacing or narrowing the application's other database clients.
 */
export interface BillingDatabase {
  public: {
    Tables: {
      billing_plans: {
        Row: {
          code: string;
          name: string;
          billing_interval: BillingInterval;
          amount_kobo: number;
          currency: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          name: string;
          billing_interval: BillingInterval;
          amount_kobo: number;
          currency?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          name?: string;
          billing_interval?: BillingInterval;
          amount_kobo?: number;
          currency?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_code: string;
          status: SubscriptionStatus;
          amount_kobo: number;
          currency: string;
          paystack_customer_code: string | null;
          paystack_subscription_code: string | null;
          paystack_email_token: string | null;
          authorization_signature: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          cancelled_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_code: string;
          status?: SubscriptionStatus;
          amount_kobo: number;
          currency?: string;
          paystack_customer_code?: string | null;
          paystack_subscription_code?: string | null;
          paystack_email_token?: string | null;
          authorization_signature?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_code?: string;
          status?: SubscriptionStatus;
          amount_kobo?: number;
          currency?: string;
          paystack_customer_code?: string | null;
          paystack_subscription_code?: string | null;
          paystack_email_token?: string | null;
          authorization_signature?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_code_fkey";
            columns: ["plan_code"];
            isOneToOne: false;
            referencedRelation: "billing_plans";
            referencedColumns: ["code"];
          },
        ];
      };
      payment_transactions: {
        Row: {
          id: string;
          user_id: string;
          subscription_id: string | null;
          plan_code: string | null;
          reference: string;
          gateway: string;
          gateway_transaction_id: string | null;
          amount_kobo: number;
          currency: string;
          status: PaymentStatus;
          paid_at: string | null;
          gateway_response: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription_id?: string | null;
          plan_code: string | null;
          reference: string;
          gateway?: string;
          gateway_transaction_id?: string | null;
          amount_kobo: number;
          currency?: string;
          status?: PaymentStatus;
          paid_at?: string | null;
          gateway_response?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subscription_id?: string | null;
          plan_code?: string | null;
          reference?: string;
          gateway?: string;
          gateway_transaction_id?: string | null;
          amount_kobo?: number;
          currency?: string;
          status?: PaymentStatus;
          paid_at?: string | null;
          gateway_response?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_transactions_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_transactions_plan_code_fkey";
            columns: ["plan_code"];
            isOneToOne: false;
            referencedRelation: "billing_plans";
            referencedColumns: ["code"];
          },
        ];
      };
      paystack_webhook_events: {
        Row: {
          id: string;
          event_key: string;
          event_type: string;
          paystack_event_id: string | null;
          signature_verified: boolean;
          processed: boolean;
          processing_error: string | null;
          payload: Json;
          received_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          event_key: string;
          event_type: string;
          paystack_event_id?: string | null;
          signature_verified?: boolean;
          processed?: boolean;
          processing_error?: string | null;
          payload: Json;
          received_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          event_key?: string;
          event_type?: string;
          paystack_event_id?: string | null;
          signature_verified?: boolean;
          processed?: boolean;
          processing_error?: string | null;
          payload?: Json;
          received_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

export type BillingSubscriptionUpdate = BillingDatabase["public"]["Tables"]["subscriptions"]["Update"];
export type BillingSubscriptionEventRow = Pick<
  BillingDatabase["public"]["Tables"]["subscriptions"]["Row"],
  "id" | "status" | "current_period_end"
>;
