import { auth, db, user } from '../firebase';
import type { Draft } from '$lib/validate/model';
import { browser } from '$app/environment';

// Import Firestore types without importing the actual implementation
type FirestoreDocument = {
  id: string;
  [key: string]: any;
};

// Collection names
const TEAMS_COLLECTION = 'teams';

interface SaveTeamResult {
  success: boolean;
  teamId?: string;
  error?: any;
}

interface GetTeamsResult {
  success: boolean;
  teams?: any[];
  error?: any;
}

interface DeleteTeamResult {
  success: boolean;
  error?: any;
}

/**
 * Save a team to the user's account
 */
export async function saveTeam(teamData: Draft, teamName: string): Promise<SaveTeamResult> {
  if (!browser) return { success: false, error: "Cannot run on server" };
  if (!auth?.currentUser) return { success: false, error: "User not authenticated" };
  
  try {
    const userId = auth.currentUser.uid;
    
    // Create a timestamp for tracking creation/update time
    const timestamp = new Date().toISOString();
    
    // Create the team document
    const teamDoc = {
      userId,
      teamName,
      teamData,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    // Dynamically import Firestore functions
    const { collection, addDoc } = await import('firebase/firestore');
    
    // Add the document to the teams collection
    const teamsCollectionRef = collection(db, TEAMS_COLLECTION);
    const docRef = await addDoc(teamsCollectionRef, teamDoc);
    
    return { success: true, teamId: docRef.id };
  } catch (error) {
    console.error("Error saving team:", error);
    return { success: false, error };
  }
}

/**
 * Get all teams for the current user
 */
export async function getUserTeams(): Promise<GetTeamsResult> {
  if (!browser) return { success: false, error: "Cannot run on server" };
  if (!auth?.currentUser) return { success: false, error: "User not authenticated" };
  
  try {
    const userId = auth.currentUser.uid;
    
    // Dynamically import Firestore functions
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    
    // Query the teams collection for documents with the user's ID
    const teamsCollectionRef = collection(db, TEAMS_COLLECTION);
    const q = query(teamsCollectionRef, where("userId", "==", userId));
    const teamsSnapshot = await getDocs(q);
    
    if (!teamsSnapshot.empty) {
      const teams = teamsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by updated time, newest first
      teams.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
      return { success: true, teams };
    } else {
      return { success: true, teams: [] };
    }
  } catch (error) {
    console.error("Error getting user teams:", error);
    return { success: false, error };
  }
}

/**
 * Delete a team
 */
export async function deleteTeam(teamId: string): Promise<DeleteTeamResult> {
  if (!browser) return { success: false, error: "Cannot run on server" };
  if (!auth?.currentUser) return { success: false, error: "User not authenticated" };
  
  try {
    const userId = auth.currentUser.uid;
    
    // Dynamically import Firestore functions
    const { doc, getDoc, deleteDoc } = await import('firebase/firestore');
    
    // First verify this team belongs to the user
    const teamDocRef = doc(db, TEAMS_COLLECTION, teamId);
    const teamDoc = await getDoc(teamDocRef);
    
    if (!teamDoc.exists()) {
      return { success: false, error: "Team not found" };
    }
    
    const teamData = teamDoc.data();
    if (teamData.userId !== userId) {
      return { success: false, error: "Unauthorized access to team" };
    }
    
    // Delete the team document
    await deleteDoc(teamDocRef);
    
    return { success: true };
  } catch (error) {
    console.error("Error deleting team:", error);
    return { success: false, error };
  }
}