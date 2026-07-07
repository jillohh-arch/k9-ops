"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { db } from "@/lib/firebase/client";

type RawRecord = Record<string, unknown> & { _id: string };

type EntitiesState = {
  dogs: RawRecord[];
  dogsLoading: boolean;
  error: string | null;
  users: RawRecord[];
  usersLoading: boolean;
  vehicles: RawRecord[];
  vehiclesLoading: boolean;
};

const initialState: EntitiesState = {
  dogs: [],
  dogsLoading: true,
  error: null,
  users: [],
  usersLoading: true,
  vehicles: [],
  vehiclesLoading: true,
};

const EntitiesContext = createContext<EntitiesState>(initialState);

export function EntitiesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EntitiesState>(initialState);

  useEffect(() => {
    const dogsQuery = query(
      collection(db, "dogs"),
      where("active", "==", true),
    );
    const usersQuery = query(
      collection(db, "users"),
      where("active", "==", true),
    );
    const vehiclesQuery = query(
      collection(db, "vehicles"),
      where("active", "==", true),
    );

    const unsubDogs = onSnapshot(
      dogsQuery,
      (snapshot) => {
        const records = snapshot.docs.map((doc) => ({
          ...doc.data(),
          _id: doc.id,
        }));
        setState((prev) => ({ ...prev, dogs: records, dogsLoading: false }));
      },
      (err) => {
        setState((prev) => ({
          ...prev,
          dogsLoading: false,
          error: prev.error ? `${prev.error} | dogs: ${err.message}` : `dogs: ${err.message}`,
        }));
      },
    );

    const unsubUsers = onSnapshot(
      usersQuery,
      (snapshot) => {
        const records = snapshot.docs.map((doc) => ({
          ...doc.data(),
          _id: doc.id,
        }));
        setState((prev) => ({ ...prev, users: records, usersLoading: false }));
      },
      (err) => {
        setState((prev) => ({
          ...prev,
          usersLoading: false,
          error: prev.error ? `${prev.error} | users: ${err.message}` : `users: ${err.message}`,
        }));
      },
    );

    const unsubVehicles = onSnapshot(
      vehiclesQuery,
      (snapshot) => {
        const records = snapshot.docs.map((doc) => ({
          ...doc.data(),
          _id: doc.id,
        }));
        setState((prev) => ({ ...prev, vehicles: records, vehiclesLoading: false }));
      },
      (err) => {
        setState((prev) => ({
          ...prev,
          vehiclesLoading: false,
          error: prev.error ? `${prev.error} | vehicles: ${err.message}` : `vehicles: ${err.message}`,
        }));
      },
    );

    return () => {
      unsubDogs();
      unsubUsers();
      unsubVehicles();
    };
  }, []);

  return (
    <EntitiesContext.Provider value={state}>
      {children}
    </EntitiesContext.Provider>
  );
}

export function useEntities() {
  return useContext(EntitiesContext);
}
