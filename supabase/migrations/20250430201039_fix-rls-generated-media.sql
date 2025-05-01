-- Fix RLS policy for the generated_media table

-- First, ensure RLS is enabled on the table
ALTER TABLE "public"."generated_media" ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows service role to insert records
-- This is the most immediate fix for the Edge Function
CREATE POLICY "Allow service role to insert generated_media"
ON "public"."generated_media"
FOR INSERT
TO service_role
WITH CHECK (true);

-- Also add a policy for authenticated users to insert their own records
-- This ensures the frontend can also insert records
CREATE POLICY "Enable insert for authenticated users only" 
ON "public"."generated_media"
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Add a policy for authenticated users to view their own records
CREATE POLICY "Enable select for authenticated users only" 
ON "public"."generated_media"
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);
