import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { PostgresStorage } from './db-storage';

const storage = new PostgresStorage();

// Helper function to generate API keys 
export function generateApiKey(): string {
  // Create a secure random API key with 32 bytes of entropy
  const apiKey = crypto.randomBytes(32).toString('hex');
  return apiKey;
}

// Create a new partner and generate an API key
export async function createPartner(name: string, domain: string) {
  // Generate a partner ID
  const partnerId = `partner-${uuidv4().substring(0, 8)}`;
  
  // Generate API key
  const apiKey = generateApiKey();
  
  // Store the partner info in the database
  // In a production environment, you would hash this key before storing
  try {
    const partner = await storage.createPartner({
      id: partnerId,
      name,
      domain,
      apiKey,
      createdAt: new Date(),
    });
    
    return {
      partnerId: partner.id,
      apiKey,
      name: partner.name,
      domain: partner.domain
    };
  } catch (error) {
    console.error('Error creating partner:', error);
    throw new Error('Failed to create partner');
  }
}

// Validate a partner API key
export async function validateApiKey(apiKey: string) {
  try {
    const partner = await storage.getPartnerByApiKey(apiKey);
    return !!partner;
  } catch (error) {
    console.error('Error validating API key:', error);
    return false;
  }
}

// Get partner by ID
export async function getPartner(partnerId: string) {
  try {
    return await storage.getPartner(partnerId);
  } catch (error) {
    console.error('Error getting partner:', error);
    return null;
  }
}

// Authentication middleware for Express
export function partnerAuthMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
  }
  
  const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  validateApiKey(apiKey).then(isValid => {
    if (isValid) {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    }
  }).catch(error => {
    console.error('Error in auth middleware:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  });
}