// Valloreg – az operátor (társaság) hivatalos adatai. Egy helyen, hogy minden
// jogi dokumentum ugyanazt az azonosító-blokkot használja.

export const COMPANY = {
  legalName: 'VALLOR TEAM SRL',
  brand: 'Valloreg',
  cui: '47859317',
  regCom: 'J2023000114142',
  euid: 'ROONRC.J2023000114142',
  address: 'Sat Arcuș, Cart. Poiana Arcușului nr. 102, cod 527166, jud. Covasna, România',
  phone: '0769532015',
  email: 'vallorsoft@gmail.com',
  webUrl: 'https://valloreg-web.onrender.com',
  apiUrl: 'https://valloreg-api.onrender.com',
  // Felügyeleti hatóság (RO).
  dpa: 'Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP)',
  dpaWeb: 'https://www.dataprotection.ro',
} as const;

/** Az operátor azonosító adatait felsorolásként adja vissza (RO). */
export function companyIdentityItems(): string[] {
  return [
    `Operator: ${COMPANY.legalName} (denumire comercială serviciu: „${COMPANY.brand}")`,
    `CUI: ${COMPANY.cui}`,
    `Nr. Reg. Com.: ${COMPANY.regCom}`,
    `EUID: ${COMPANY.euid}`,
    `Sediu social: ${COMPANY.address}`,
    `Telefon: ${COMPANY.phone}`,
    `E-mail / Responsabil protecția datelor (punct de contact): ${COMPANY.email}`,
    `Aplicație web: ${COMPANY.webUrl}`,
    `API: ${COMPANY.apiUrl}`,
  ];
}
