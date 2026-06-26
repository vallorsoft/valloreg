-- A megerősített (járműként mentett) beolvasás hivatkozása a létrejött járműre.
-- A status mező felveheti a 'CONFIRMED' értéket (String oszlop, nincs enum-változás).
ALTER TABLE "vehicle_scans" ADD COLUMN "confirmedVehicleId" TEXT;
