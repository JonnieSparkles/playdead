// ArNS (Arweave Name Service) utilities

import { logger } from './logger.js';

// ---------- ArNS functions ----------
export async function checkUndernameAvailability(ant, undername) {
  try {
    const existingRecords = await ant.getRecords();
    if (existingRecords && existingRecords[undername]) {
      return { available: false, existing: existingRecords[undername] };
    }
    return { available: true, existing: null };
  } catch (error) {
    // Return available=true to allow attempt (better to try and fail than block on API issues)
    return { available: true, existing: null, error: error.message };
  }
}

export async function createUndernameRecord(ant, undername, txId, ttlSeconds) {
  try {
    const result = await Promise.race([
      ant.setUndernameRecord({
        undername: undername,
        transactionId: txId,
        ttlSeconds: ttlSeconds
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('ArNS assignment timeout after 120 seconds')), 120000)
      )
    ]);
    
    return { success: true, recordId: result.id, result };
  } catch (error) {
    // Check if it's a "name taken" error
    if (error.message?.includes('already exists') || error.message?.includes('taken')) {
      return { success: false, error: 'undername_taken', message: error.message };
    }
    
    // Check if it's a timeout error - verify if assignment actually succeeded
    if (error.message?.includes('timeout')) {
      try {
        const records = await ant.getRecords();
        if (records && records[undername]) {
          return { success: true, recordId: records[undername].id, result: records[undername] };
        }
        return { success: false, error: 'timeout', message: 'Assignment failed after timeout' };
      } catch (verifyError) {
        return { success: false, error: 'timeout', message: 'Assignment failed after timeout' };
      }
    }
    
    return { success: false, error: 'creation_failed', message: error.message };
  }
}

export async function updateUndernameRecord(ant, undername, txId, ttlSeconds) {
  try {
    const result = await Promise.race([
      ant.setUndernameRecord({
        undername: undername,
        transactionId: txId,
        ttlSeconds: ttlSeconds
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('ArNS assignment timeout after 120 seconds')), 120000)
      )
    ]);
    
    return { success: true, recordId: result.id, result };
  } catch (error) {
    // Check if it's a timeout error - verify if assignment actually succeeded
    if (error.message?.includes('timeout')) {
      try {
        const records = await ant.getRecords();
        if (records && records[undername]) {
          return { success: true, recordId: records[undername].id, result: records[undername] };
        }
        return { success: false, error: 'timeout', message: 'Assignment failed after timeout' };
      } catch (verifyError) {
        return { success: false, error: 'timeout', message: 'Assignment failed after timeout' };
      }
    }
    
    return { success: false, error: 'update_failed', message: error.message };
  }
}

export async function getUndernameRecord(ant, undername) {
  try {
    const records = await ant.getRecords();
    return records?.[undername] || null;
  } catch (error) {
    // If the error is due to JSON parsing (ArNS service returning HTML), 
    // return null to allow deployment to continue
    return null;
  }
}

export async function setRootRecord(ant, txId, ttlSeconds) {
  try {
    const result = await Promise.race([
      ant.setRecord({
        undername: "@",
        transactionId: txId,
        ttlSeconds: ttlSeconds
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('ArNS root record timeout after 120 seconds')), 120000)
      )
    ]);
    
    return { success: true, recordId: result.id, result };
  } catch (error) {
    if (error.message?.includes('timeout')) {
      try {
        const records = await ant.getRecords();
        if (records && records["@"]) {
          return { success: true, recordId: records["@"].id, result: records["@"] };
        }
        return { success: false, error: 'timeout', message: 'Root record assignment failed after timeout' };
      } catch (verifyError) {
        return { success: false, error: 'timeout', message: 'Root record assignment failed after timeout' };
      }
    }
    return { success: false, error: 'root_record_failed', message: error.message };
  }
}