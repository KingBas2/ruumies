import { supabase } from '@/lib/supabase';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

export type Household = {
  id: string;
  name: string;
  invite_code: string;
};

type HouseholdContextValue = {
  household: Household | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setHousehold(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('household_members')
      .select('households(id, name, invite_code)')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) console.error(error);
    setHousehold((data?.households as Household | undefined) ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <HouseholdContext.Provider value={{ household, loading, refresh }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error('useHousehold muss innerhalb von HouseholdProvider verwendet werden');
  }
  return context;
}