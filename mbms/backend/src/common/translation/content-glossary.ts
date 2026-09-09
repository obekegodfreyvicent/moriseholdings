// Content localisation glossary (27 August 2026)
// ----------------------------------------------
// Curated, bidirectional vocabulary for the finite set of database values the
// Customer Storefront shows or a customer types: product-category names,
// units of measure, delivery-address label words, and the recurring tokens in
// the seeded product names. English is the key; the fully-translated
// storefront languages get a value.
//
// Free-form text (product descriptions, support-ticket bodies) is NOT in
// here — that goes through the TranslationProvider seam
// (translation.provider.ts), whose default implementation is a no-op. Wire a
// real machine-translation service there to cover arbitrary prose.

export const GLOSSARY_LANGS = ['sw', 'lg', 'fr', 'es', 'pt', 'de', 'it', 'ar'] as const;
export type GlossaryLang = (typeof GLOSSARY_LANGS)[number];

// Figure / numeral localisation (27 August 2026)
// ---------------------------------------------
// Some languages render digits in a non-Western script. On READ, digits in
// database text (e.g. "25kg" inside a product name) are transliterated into
// the language's script; on WRITE, any such digits a customer typed are
// transliterated back to 0-9 before the value is stored (canonical English).
export const DIGIT_SCRIPTS: Partial<Record<string, string>> = {
  ar: '٠١٢٣٤٥٦٧٨٩', // Arabic-Indic
};

/** Map ASCII digits in `text` into `lang`'s script (no-op if it uses 0-9). */
export function toLocaleDigits(text: string, lang: string): string {
  const script = DIGIT_SCRIPTS[lang];
  if (!script) return text;
  return text.replace(/[0-9]/g, (d) => script[Number(d)]);
}

/** Map any non-Western digit in `text` back to 0-9. */
export function toWesternDigits(text: string): string {
  let out = '';
  for (const ch of text) {
    let mapped = ch;
    for (const script of Object.values(DIGIT_SCRIPTS)) {
      const i = script!.indexOf(ch);
      if (i !== -1) {
        mapped = String(i);
        break;
      }
    }
    out += mapped;
  }
  return out;
}

type Entry = Partial<Record<GlossaryLang, string>>;

// Exact-phrase matches, tried before token-level. Keys are canonical English.
export const PHRASES: Record<string, Entry> = {
  'Agro Inputs': { sw: 'Pembejeo za Kilimo', lg: 'Ebikozesebwa mu Bulimi', fr: 'Intrants agricoles', es: 'Insumos agrícolas', pt: 'Insumos agrícolas', de: 'Agrar-Betriebsmittel', it: 'Mezzi agricoli', ar: 'مدخلات زراعية' },
  Packaging: { sw: 'Ufungashaji', lg: 'Okupakinga', fr: 'Emballage', es: 'Embalaje', pt: 'Embalagem', de: 'Verpackung', it: 'Imballaggio', ar: 'التعبئة والتغليف' },
  Fuel: { sw: 'Mafuta', lg: 'Amafuta g’ekyuma', fr: 'Carburant', es: 'Combustible', pt: 'Combustível', de: 'Kraftstoff', it: 'Carburante', ar: 'وقود' },
  Warehouse: { sw: 'Ghala', lg: 'Sitoowa', fr: 'Entrepôt', es: 'Almacén', pt: 'Armazém', de: 'Lager', it: 'Magazzino', ar: 'مستودع' },
  Logistics: { sw: 'Usafirishaji', lg: 'Entambula y’ebyamaguzi', fr: 'Logistique', es: 'Logística', pt: 'Logística', de: 'Logistik', it: 'Logistica', ar: 'الخدمات اللوجستية' },
  'per litre': { sw: 'kwa lita', lg: 'buli lita', fr: 'par litre', es: 'por litro', pt: 'por litro', de: 'pro Liter', it: 'al litro', ar: 'لكل لتر' },

  // Account-statement / invoice-PDF vocabulary (30 August 2026) — the
  // customer's downloadable statement and invoice are labelled in the
  // language they chose. (PDFKit's built-in font renders Latin scripts and
  // digits; non-Latin scripts fall back — see invoices.service.ts.)
  invoice: { sw: 'ankara', lg: 'inivoosi', fr: 'facture', es: 'factura', pt: 'fatura', de: 'Rechnung', it: 'fattura', ar: 'فاتورة' },
  payment: { sw: 'malipo', lg: 'okusasula', fr: 'paiement', es: 'pago', pt: 'pagamento', de: 'Zahlung', it: 'pagamento', ar: 'دفعة' },
  'Account Statement': { sw: 'Taarifa ya Akaunti', lg: 'Alipoota ya Akkawunti', fr: 'Relevé de compte', es: 'Estado de cuenta', pt: 'Extrato de conta', de: 'Kontoauszug', it: 'Estratto conto', ar: 'كشف حساب' },
  Balance: { sw: 'Salio', lg: 'Ssente ezisigadde', fr: 'Solde', es: 'Saldo', pt: 'Saldo', de: 'Saldo', it: 'Saldo', ar: 'الرصيد' },
  Date: { sw: 'Tarehe', lg: 'Ennaku z’omwezi', fr: 'Date', es: 'Fecha', pt: 'Data', de: 'Datum', it: 'Data', ar: 'التاريخ' },
  Type: { sw: 'Aina', lg: 'Ekika', fr: 'Type', es: 'Tipo', pt: 'Tipo', de: 'Art', it: 'Tipo', ar: 'النوع' },
  Reference: { sw: 'Kumbukumbu', lg: 'Namba y’okujuliza', fr: 'Référence', es: 'Referencia', pt: 'Referência', de: 'Referenz', it: 'Riferimento', ar: 'المرجع' },
  Amount: { sw: 'Kiasi', lg: 'Omuwendo', fr: 'Montant', es: 'Importe', pt: 'Valor', de: 'Betrag', it: 'Importo', ar: 'المبلغ' },
  'Running Balance': { sw: 'Salio Linaloendelea', lg: 'Ssente ezisigadde nga bwe zigenda', fr: 'Solde courant', es: 'Saldo acumulado', pt: 'Saldo corrente', de: 'Laufender Saldo', it: 'Saldo progressivo', ar: 'الرصيد الجاري' },
  Order: { sw: 'Oda', lg: 'Odda', fr: 'Commande', es: 'Pedido', pt: 'Pedido', de: 'Bestellung', it: 'Ordine', ar: 'الطلب' },
  Status: { sw: 'Hali', lg: 'Embeera', fr: 'Statut', es: 'Estado', pt: 'Estado', de: 'Status', it: 'Stato', ar: 'الحالة' },
  Field: { sw: 'Sehemu', lg: 'Ekitundu', fr: 'Champ', es: 'Campo', pt: 'Campo', de: 'Feld', it: 'Campo', ar: 'الحقل' },
  Value: { sw: 'Thamani', lg: 'Omuwendo', fr: 'Valeur', es: 'Valor', pt: 'Valor', de: 'Wert', it: 'Valore', ar: 'القيمة' },
  'Invoice Number': { sw: 'Namba ya Ankara', lg: 'Namba ya Inivoosi', fr: 'Numéro de facture', es: 'Número de factura', pt: 'Número da fatura', de: 'Rechnungsnummer', it: 'Numero fattura', ar: 'رقم الفاتورة' },
  'Order Number': { sw: 'Namba ya Oda', lg: 'Namba ya Odda', fr: 'Numéro de commande', es: 'Número de pedido', pt: 'Número do pedido', de: 'Bestellnummer', it: 'Numero ordine', ar: 'رقم الطلب' },
  'Due Date': { sw: 'Tarehe ya Mwisho', lg: 'Ennaku z’okusasula', fr: "Date d'échéance", es: 'Fecha de vencimiento', pt: 'Data de vencimento', de: 'Fälligkeitsdatum', it: 'Data di scadenza', ar: 'تاريخ الاستحقاق' },
  'Paid At': { sw: 'Ililipwa Tarehe', lg: 'Yasasulwa ku', fr: 'Payée le', es: 'Pagada el', pt: 'Paga em', de: 'Bezahlt am', it: 'Pagata il', ar: 'دُفعت في' },
  paid: { sw: 'imelipwa', lg: 'yasasulwa', fr: 'payée', es: 'pagada', pt: 'paga', de: 'bezahlt', it: 'pagata', ar: 'مدفوعة' },
  overdue: { sw: 'imepitwa na wakati', lg: 'yayitiddwa ekiseera', fr: 'en retard', es: 'vencida', pt: 'em atraso', de: 'überfällig', it: 'scaduta', ar: 'متأخرة' },
  due_soon: { sw: 'inakaribia kuisha', lg: 'eneetera okuggwaako', fr: 'à échéance proche', es: 'por vencer', pt: 'a vencer em breve', de: 'bald fällig', it: 'in scadenza', ar: 'مستحقة قريباً' },
  upcoming: { sw: 'inayokuja', lg: 'ejja mu maaso', fr: 'à venir', es: 'próxima', pt: 'futura', de: 'anstehend', it: 'in arrivo', ar: 'قادمة' },
  'Mbale Store': { sw: 'Duka la Mbale', lg: 'Edduuka lya Mbale', fr: 'Magasin de Mbale', es: 'Tienda de Mbale', pt: 'Loja de Mbale', de: 'Geschäft Mbale', it: 'Negozio di Mbale', ar: 'متجر مبالي' },
  'Soroti Depot': { sw: 'Bohari ya Soroti', lg: 'Sitoowa ya Soroti', fr: 'Dépôt de Soroti', es: 'Depósito de Soroti', pt: 'Depósito de Soroti', de: 'Depot Soroti', it: 'Deposito di Soroti', ar: 'مستودع سوروتي' },

  // Group storefront — Logistics / Clearing & Forwarding / Warehouse
  // Management catalogue category names (29 August 2026).
  'Freight Services': { sw: 'Huduma za Usafirishaji', lg: 'Obuweereza bw’Entambula y’Ebyamaguzi', fr: 'Services de fret', es: 'Servicios de flete', pt: 'Serviços de frete', de: 'Frachtdienste', it: 'Servizi di trasporto merci', ar: 'خدمات الشحن' },
  'Warehousing Services': { sw: 'Huduma za Ghala', lg: 'Obuweereza bwa Sitoowa', fr: "Services d'entreposage", es: 'Servicios de almacenamiento', pt: 'Serviços de armazenagem', de: 'Lagerdienste', it: 'Servizi di magazzinaggio', ar: 'خدمات التخزين' },
  'Customs Clearance': { sw: 'Uidhinishaji wa Forodha', lg: 'Okuggya ebyamaguzi mu Kasawo', fr: 'Dédouanement', es: 'Despacho de aduanas', pt: 'Desembaraço aduaneiro', de: 'Zollabfertigung', it: 'Sdoganamento', ar: 'التخليص الجمركي' },
  'Freight Forwarding': { sw: 'Usafirishaji wa Mizigo', lg: 'Okusindika Ebyamaguzi', fr: 'Transit de marchandises', es: 'Agenciamiento de carga', pt: 'Agenciamento de carga', de: 'Speditionswesen', it: 'Spedizioni merci', ar: 'شحن البضائع' },
  'Transit & Documentation': { sw: 'Usafiri wa Njia na Nyaraka', lg: 'Entambula ey’Okuyita n’Ebiwandiiko', fr: 'Transit et documentation', es: 'Tránsito y documentación', pt: 'Trânsito e documentação', de: 'Transit und Dokumentation', it: 'Transito e documentazione', ar: 'العبور والمستندات' },
  Storage: { sw: 'Uhifadhi', lg: 'Okutereka', fr: 'Stockage', es: 'Almacenamiento', pt: 'Armazenamento', de: 'Lagerung', it: 'Stoccaggio', ar: 'التخزين' },
  'Handling & Fulfilment': { sw: 'Ushughulikiaji na Utimizaji', lg: 'Okukwata n’Okutuukiriza Odda', fr: 'Manutention et préparation de commandes', es: 'Manipulación y preparación de pedidos', pt: 'Manuseio e processamento de pedidos', de: 'Handling und Auftragsabwicklung', it: 'Movimentazione ed evasione ordini', ar: 'المناولة وتجهيز الطلبات' },
  'Value-Added Services': { sw: 'Huduma za Ziada', lg: 'Obuweereza obw’Omugaso', fr: 'Services à valeur ajoutée', es: 'Servicios de valor añadido', pt: 'Serviços de valor acrescentado', de: 'Mehrwertdienste', it: 'Servizi a valore aggiunto', ar: 'خدمات ذات قيمة مضافة' },

  // Collateral-management catalogue category names (30 August 2026) —
  // Morise Collateral Management Ltd's storefront service categories.
  'Custody & Control': { sw: 'Uhifadhi na Udhibiti', lg: 'Okukuuma n’Okufuga', fr: 'Garde et contrôle', es: 'Custodia y control', pt: 'Custódia e controlo', de: 'Verwahrung und Kontrolle', it: 'Custodia e controllo', ar: 'الحفظ والرقابة' },
  'Inspection & Verification': { sw: 'Ukaguzi na Uthibitishaji', lg: 'Okukebera n’Okukakasa', fr: 'Inspection et vérification', es: 'Inspección y verificación', pt: 'Inspeção e verificação', de: 'Inspektion und Verifizierung', it: 'Ispezione e verifica', ar: 'التفتيش والتحقق' },
  'Stock & Movement Control': { sw: 'Udhibiti wa Hisa na Mwendo', lg: 'Okufuga Ebintu n’Entambula yaabyo', fr: 'Contrôle des stocks et des mouvements', es: 'Control de existencias y movimientos', pt: 'Controlo de existências e movimentos', de: 'Bestands- und Bewegungskontrolle', it: 'Controllo scorte e movimenti', ar: 'مراقبة المخزون والحركة' },
  'Risk & Valuation': { sw: 'Hatari na Uthaminishaji', lg: 'Akabi n’Okubalirira Omuwendo', fr: 'Risque et valorisation', es: 'Riesgo y valoración', pt: 'Risco e avaliação', de: 'Risiko und Bewertung', it: 'Rischio e valutazione', ar: 'المخاطر والتقييم' },

  // Marketing & Promos + CMS / Site Builder storefront strings (28 August
  // 2026). The customer-facing promo banner and the seeded content pages are
  // rendered in the chosen language through this glossary, the same seam the
  // catalogue and support screens use. Longer body prose beyond these exact
  // matches falls through to the translation provider (a no-op until a real
  // machine-translation service is configured).
  'Shop now': { sw: 'Nunua sasa', lg: 'Gula kati', fr: 'Acheter', es: 'Comprar ahora', pt: 'Comprar agora', de: 'Jetzt einkaufen', it: 'Acquista ora', ar: 'تسوّق الآن' },
  'About Morise': { sw: 'Kuhusu Morise', lg: 'Ku bikwata ku Morise', fr: 'À propos de Morise', es: 'Acerca de Morise', pt: 'Sobre a Morise', de: 'Über Morise', it: 'Chi è Morise', ar: 'عن مورايز' },
  'Terms & Conditions': { sw: 'Sheria na Masharti', lg: 'Ebiragiro n’Endagaano', fr: 'Conditions générales', es: 'Términos y condiciones', pt: 'Termos e condições', de: 'Allgemeine Geschäftsbedingungen', it: 'Termini e condizioni', ar: 'الشروط والأحكام' },
  'Delivery & Returns': { sw: 'Uwasilishaji na Marejesho', lg: 'Okutuusa n’Okuzzaayo', fr: 'Livraison et retours', es: 'Envíos y devoluciones', pt: 'Entrega e devoluções', de: 'Lieferung und Rückgabe', it: 'Consegna e resi', ar: 'التوصيل والإرجاع' },

  // Site-disclaimer statements (30 August 2026) — the seeded statements
  // shown on the full-page disclaimer gate. Admin-added prose beyond these
  // exact matches falls through to the translation provider (a no-op until
  // a real machine-translation service is configured), the same as CMS
  // content-page bodies.
  'This is an internal proof-of-concept build of the Morise Holdings Limited Business Management System.': {
    sw: 'Hii ni toleo la ndani la Mfumo wa Usimamizi wa Biashara wa Morise Holdings Limited kwa ajili ya majaribio ya dhana.',
    lg: 'Kino kifaananyi kya munda eky’okugezesa endowooza ekya Sisitemu ya Morise Holdings Limited ey’Okuddukanya Bizinensi.',
    fr: 'Il s’agit d’une version interne de démonstration du système de gestion d’entreprise de Morise Holdings Limited.',
    es: 'Esta es una versión interna de prueba de concepto del Sistema de Gestión Empresarial de Morise Holdings Limited.',
    pt: 'Esta é uma versão interna de prova de conceito do Sistema de Gestão Empresarial da Morise Holdings Limited.',
    de: 'Dies ist eine interne Machbarkeitsstudie des Business-Management-Systems von Morise Holdings Limited.',
    it: 'Questa è una build interna proof-of-concept del sistema di gestione aziendale di Morise Holdings Limited.',
    ar: 'هذه نسخة داخلية تجريبية لإثبات المفهوم من نظام إدارة الأعمال لدى مورايز هولدنجز ليمتد.',
  },
  'Companies, figures, staff names, prices and news items shown here are illustrative demonstration data.': {
    sw: 'Kampuni, takwimu, majina ya wafanyakazi, bei na habari zinazoonyeshwa hapa ni data ya onyesho ya mfano.',
    lg: 'Kkampuni, ennamba, amannya g’abakozi, emiwendo n’amawulire agalagibwa wano bya kulaga byokka.',
    fr: 'Les sociétés, chiffres, noms du personnel, prix et actualités présentés ici sont des données de démonstration illustratives.',
    es: 'Las empresas, cifras, nombres del personal, precios y noticias que se muestran aquí son datos de demostración ilustrativos.',
    pt: 'As empresas, os números, os nomes do pessoal, os preços e as notícias apresentados aqui são dados de demonstração ilustrativos.',
    de: 'Unternehmen, Zahlen, Mitarbeiternamen, Preise und Nachrichten hier sind exemplarische Demodaten.',
    it: 'Aziende, cifre, nomi del personale, prezzi e notizie qui mostrati sono dati dimostrativi illustrativi.',
    ar: 'الشركات والأرقام وأسماء الموظفين والأسعار والأخبار المعروضة هنا هي بيانات عرض توضيحية.',
  },
  'No real order is fulfilled and no real payment is taken; payment flows are simulated with no gateway connected.': {
    sw: 'Hakuna oda halisi inayotimizwa na hakuna malipo halisi yanayochukuliwa; mtiririko wa malipo unaigwa bila lango lililounganishwa.',
    lg: 'Tewali odda ntuufu etuukirizibwa era tewali nsimbi ntuufu ezitwalibwa; enkola y’okusasula ekolebwa nga tewali gateway efundikkiddwa.',
    fr: 'Aucune commande réelle n’est traitée et aucun paiement réel n’est prélevé ; les flux de paiement sont simulés sans passerelle connectée.',
    es: 'No se tramita ningún pedido real ni se cobra ningún pago real; los flujos de pago se simulan sin ninguna pasarela conectada.',
    pt: 'Nenhum pedido real é processado e nenhum pagamento real é cobrado; os fluxos de pagamento são simulados sem qualquer gateway ligado.',
    de: 'Es wird keine echte Bestellung ausgeführt und keine echte Zahlung eingezogen; Zahlungsabläufe sind ohne angebundenes Gateway simuliert.',
    it: 'Nessun ordine reale viene evaso e nessun pagamento reale viene addebitato; i flussi di pagamento sono simulati senza alcun gateway collegato.',
    ar: 'لا يتم تنفيذ أي طلب حقيقي ولا يتم تحصيل أي دفعة حقيقية؛ تدفقات الدفع محاكاة دون أي بوابة متصلة.',
  },
  'Do not enter genuine personal, financial or confidential information anywhere in this environment.': {
    sw: 'Usiingize taarifa halisi za binafsi, za kifedha au za siri popote katika mazingira haya.',
    lg: 'Toteeka bikwata ku muntu, bya ssente oba bya kyama ebituufu wonna mu kifo kino.',
    fr: 'N’entrez aucune information personnelle, financière ou confidentielle réelle dans cet environnement.',
    es: 'No introduzca información personal, financiera o confidencial real en ningún lugar de este entorno.',
    pt: 'Não introduza informações pessoais, financeiras ou confidenciais reais em qualquer parte deste ambiente.',
    de: 'Geben Sie in dieser Umgebung nirgends echte persönliche, finanzielle oder vertrauliche Informationen ein.',
    it: 'Non inserire informazioni personali, finanziarie o riservate reali in nessun punto di questo ambiente.',
    ar: 'لا تُدخل أي معلومات شخصية أو مالية أو سرية حقيقية في أي مكان في هذه البيئة.',
  },
  'Access to the customer portal is issued by Morise Holdings Limited to existing business accounts; there is no public self-registration for real accounts.': {
    sw: 'Ufikiaji wa lango la wateja hutolewa na Morise Holdings Limited kwa akaunti za biashara zilizopo; hakuna usajili wa umma wa akaunti halisi.',
    lg: 'Okuyingira mu portal y’abaguzi kuweebwa Morise Holdings Limited eri akawuntu z’obusuubuzi eziriwo; tewali kwewandiisa kwa bantu bonna kwa kawuntu ntuufu.',
    fr: 'L’accès au portail client est attribué par Morise Holdings Limited aux comptes professionnels existants ; il n’existe pas d’inscription publique pour de vrais comptes.',
    es: 'El acceso al portal de clientes lo otorga Morise Holdings Limited a las cuentas comerciales existentes; no hay registro público para cuentas reales.',
    pt: 'O acesso ao portal do cliente é atribuído pela Morise Holdings Limited a contas empresariais existentes; não há registo público para contas reais.',
    de: 'Der Zugang zum Kundenportal wird von Morise Holdings Limited an bestehende Geschäftskonten vergeben; eine öffentliche Registrierung für echte Konten gibt es nicht.',
    it: 'L’accesso al portale clienti è concesso da Morise Holdings Limited agli account aziendali esistenti; non esiste una registrazione pubblica per account reali.',
    ar: 'يُمنح الوصول إلى بوابة العملاء من قِبل مورايز هولدنجز ليمتد للحسابات التجارية القائمة؛ ولا يوجد تسجيل عام لحسابات حقيقية.',
  },
  'Season stock-up — free delivery over UGX 1,000,000': {
    sw: 'Jaza bidhaa za msimu — usafirishaji bure kwa oda zaidi ya UGX 1,000,000',
    lg: 'Terekera ebintu by’omu kiseera — okutuusa okwa bwereere ku odda ezisukka UGX 1,000,000',
    fr: 'Faites le plein pour la saison — livraison gratuite au-delà de 1 000 000 UGX',
    es: 'Abastécete para la temporada — envío gratis por encima de 1 000 000 UGX',
    pt: 'Abasteça-se para a época — entrega grátis acima de UGX 1.000.000',
    de: 'Bevorraten Sie sich für die Saison — kostenlose Lieferung ab UGX 1.000.000',
    it: 'Fai scorta per la stagione — consegna gratuita oltre UGX 1.000.000',
    ar: 'تجهّز للموسم — توصيل مجاني للطلبات التي تزيد عن 1,000,000 شلن أوغندي',
  },
  'Order your seeds, fertiliser and inputs now. Use code WELCOME10 for 10% off your first order.': {
    sw: 'Agiza mbegu, mbolea na pembejeo zako sasa. Tumia msimbo WELCOME10 kupata punguzo la 10% kwenye oda yako ya kwanza.',
    lg: 'Laga ensigo, ekigimusa n’ebikozesebwa byo kati. Kozesa koodi WELCOME10 okufuna ekitundu kya 10% ku odda yo esooka.',
    fr: 'Commandez dès maintenant vos semences, engrais et intrants. Utilisez le code WELCOME10 pour 10 % de réduction sur votre première commande.',
    es: 'Pide ahora tus semillas, fertilizante e insumos. Usa el código WELCOME10 para un 10 % de descuento en tu primer pedido.',
    pt: 'Peça agora as suas sementes, fertilizante e insumos. Use o código WELCOME10 para 10% de desconto no seu primeiro pedido.',
    de: 'Bestellen Sie jetzt Ihr Saatgut, Dünger und Betriebsmittel. Nutzen Sie den Code WELCOME10 für 10 % Rabatt auf Ihre erste Bestellung.',
    it: 'Ordina ora sementi, fertilizzante e mezzi tecnici. Usa il codice WELCOME10 per il 10% di sconto sul primo ordine.',
    ar: 'اطلب بذورك وأسمدتك ومستلزماتك الآن. استخدم الرمز WELCOME10 للحصول على خصم 10% على طلبك الأول.',
  },
  // Storefront home banners #2 and #3 (backfilled 9 Sep 2026, Update 106) —
  // these two banners' heading/body/linkLabel were missing from the
  // glossary since Update 39, so they silently stayed in English in every
  // language while banner #1 (above) translated correctly.
  'One storefront for the whole group': {
    sw: 'Duka moja kwa kikundi kizima', lg: 'Eduuka emu ku kibiina kyonna',
    fr: 'Une seule boutique pour tout le groupe', es: 'Una sola tienda para todo el grupo',
    pt: 'Uma única loja para todo o grupo', de: 'Ein Shop für die ganze Gruppe',
    it: 'Un solo negozio per tutto il gruppo', ar: 'متجر واحد للمجموعة بأكملها',
  },
  'Browse every Morise subsidiary and branch — inputs & fuel, logistics, clearing & forwarding, warehousing and collateral management — and settle it all on one account.': {
    sw: 'Vinjari kila kampuni tanzu na tawi la Morise — pembejeo na mafuta, usafirishaji, uvushaji forodha na usafirishaji, uhifadhi na usimamizi wa dhamana — na lipa yote kwenye akaunti moja.',
    lg: 'Laba buli kkampuni ya Morise ey’oku wansi n’ettabi lyayo — ebikozesebwa n’amafuta, entambula, okuyisa ku kaditomu n’okusindika, okutereka n’okuddukanya obwewolezebwa — era osasule byonna ku akaunti emu.',
    fr: 'Parcourez toutes les filiales et succursales Morise — intrants et carburant, logistique, dédouanement et transit, entreposage et gestion des garanties — et réglez tout sur un seul compte.',
    es: 'Explore todas las filiales y sucursales de Morise — insumos y combustible, logística, despacho de aduanas y tránsito, almacenamiento y gestión de garantías — y liquide todo en una sola cuenta.',
    pt: 'Explore todas as subsidiárias e filiais da Morise — insumos e combustível, logística, desembaraço alfandegário e trânsito, armazenagem e gestão de garantias — e liquide tudo numa única conta.',
    de: 'Durchstöbern Sie jede Morise-Tochtergesellschaft und -Filiale — Betriebsmittel & Kraftstoff, Logistik, Zollabfertigung & Spedition, Lagerhaltung und Sicherheitenverwaltung — und begleichen Sie alles über ein einziges Konto.',
    it: 'Sfoglia ogni controllata e filiale Morise — mezzi tecnici e carburante, logistica, sdoganamento e spedizioni, stoccaggio e gestione delle garanzie — e salda tutto su un unico conto.',
    ar: 'تصفّح كل شركة تابعة وفرع تابع لـ Morise — المدخلات والوقود، الخدمات اللوجستية، التخليص الجمركي والشحن العابر، التخزين وإدارة الضمانات — وسدّد كل ذلك عبر حساب واحد.',
  },
  'Explore the group': {
    sw: 'Chunguza Kikundi', lg: 'Ketta ku Kibiina', fr: 'Découvrir le groupe', es: 'Explorar el grupo',
    pt: 'Explorar o grupo', de: 'Gruppe entdecken', it: 'Esplora il gruppo', ar: 'استكشف المجموعة',
  },
  'Bulk fuel and haulage, booked online': {
    sw: 'Mafuta kwa Jumla na Usafirishaji, Yanabidiwa Mtandaoni',
    lg: 'Amafuta mu Bungi n’Okusitula, Bibikkibwa ku Yintaneeti',
    fr: 'Carburant en gros et transport routier, réservés en ligne',
    es: 'Combustible a granel y transporte, reservados en línea',
    pt: 'Combustível a granel e transporte, reservados online',
    de: 'Kraftstoff im Großhandel und Transport, online gebucht',
    it: 'Carburante all’ingrosso e trasporto, prenotati online',
    ar: 'وقود بالجملة ونقل، بالحجز عبر الإنترنت',
  },
  'Schedule fuel deliveries and freight with Morise Logistics without leaving the portal. Track every consignment to the door.': {
    sw: 'Panga uwasilishaji wa mafuta na mizigo na Morise Logistics bila kuondoka kwenye lango. Fuatilia kila shehena hadi mlangoni.',
    lg: 'Teekateeka okutuusa amafuta n’emigugu ne Morise Logistics nga tovudde mu poteo. Goberera buli mugugu okutuuka ku luggi.',
    fr: 'Planifiez vos livraisons de carburant et votre fret avec Morise Logistics sans quitter le portail. Suivez chaque envoi jusqu’à votre porte.',
    es: 'Programe entregas de combustible y transporte de carga con Morise Logistics sin salir del portal. Rastree cada envío hasta la puerta.',
    pt: 'Agende entregas de combustível e frete com a Morise Logistics sem sair do portal. Acompanhe cada remessa até à porta.',
    de: 'Planen Sie Kraftstofflieferungen und Frachttransporte mit Morise Logistics, ohne das Portal zu verlassen. Verfolgen Sie jede Sendung bis vor die Tür.',
    it: 'Pianifica consegne di carburante e trasporto merci con Morise Logistics senza uscire dal portale. Monitora ogni spedizione fino alla porta.',
    ar: 'جدول عمليات توصيل الوقود والشحن مع Morise Logistics دون مغادرة البوابة. تتبّع كل شحنة حتى الباب.',
  },
  'Book a delivery': {
    sw: 'Panga Uwasilishaji', lg: 'Bikka Okutuusa', fr: 'Réserver une livraison', es: 'Reservar una entrega',
    pt: 'Reservar uma entrega', de: 'Lieferung buchen', it: 'Prenota una consegna', ar: 'احجز عملية توصيل',
  },
  'Morise Holdings Limited is a Ugandan group supplying agricultural inputs, fuel, logistics and warehousing to businesses across the region. This storefront lets our account customers browse the catalogue, place orders, track deliveries and settle invoices online.': {
    sw: 'Morise Holdings Limited ni kampuni ya Uganda inayotoa pembejeo za kilimo, mafuta, usafirishaji na uhifadhi ghalani kwa biashara kote katika eneo hili. Duka hili la mtandaoni linawaruhusu wateja wetu wa akaunti kuvinjari katalogi, kuweka oda, kufuatilia uwasilishaji na kulipa ankara mtandaoni.',
    lg: 'Morise Holdings Limited kampuni ya Uganda egaba ebikozesebwa mu bulimi, amafuta, entambula n’okutereka mu masitoowa eri bizinensi mu kitundu kyonna. Eddwaliro lino ery’oku yintaneeti liwa bakasitoma baffe abalina akaawunti okulaba kataloogu, okuteeka odda, okugoberera okutuusa n’okusasula inuvoyisi ku yintaneeti.',
    fr: 'Morise Holdings Limited est un groupe ougandais qui fournit des intrants agricoles, du carburant, de la logistique et de l’entreposage aux entreprises de toute la région. Cette boutique en ligne permet à nos clients titulaires d’un compte de parcourir le catalogue, de passer commande, de suivre les livraisons et de régler les factures en ligne.',
    es: 'Morise Holdings Limited es un grupo ugandés que suministra insumos agrícolas, combustible, logística y almacenamiento a empresas de toda la región. Esta tienda en línea permite a nuestros clientes con cuenta explorar el catálogo, realizar pedidos, hacer seguimiento de las entregas y pagar las facturas en línea.',
    pt: 'A Morise Holdings Limited é um grupo ugandês que fornece insumos agrícolas, combustível, logística e armazenagem a empresas de toda a região. Esta loja online permite que os nossos clientes com conta naveguem pelo catálogo, façam pedidos, acompanhem as entregas e paguem as faturas online.',
    de: 'Morise Holdings Limited ist eine ugandische Unternehmensgruppe, die Unternehmen in der gesamten Region mit Agrar-Betriebsmitteln, Kraftstoff, Logistik und Lagerhaltung beliefert. Über diesen Online-Shop können unsere Kunden mit Konto den Katalog durchsuchen, Bestellungen aufgeben, Lieferungen verfolgen und Rechnungen online begleichen.',
    it: 'Morise Holdings Limited è un gruppo ugandese che fornisce mezzi agricoli, carburante, logistica e stoccaggio a imprese di tutta la regione. Questo negozio online consente ai nostri clienti titolari di un conto di sfogliare il catalogo, effettuare ordini, monitorare le consegne e pagare le fatture online.',
    ar: 'شركة Morise Holdings Limited مجموعة أوغندية تزوّد الشركات في جميع أنحاء المنطقة بالمدخلات الزراعية والوقود والخدمات اللوجستية والتخزين. يتيح هذا المتجر الإلكتروني لعملائنا أصحاب الحسابات تصفّح الكتالوج وتقديم الطلبات وتتبّع التسليمات وتسوية الفواتير عبر الإنترنت.',
  },
  'All orders placed through this storefront are subject to Morise Holdings Limited standard terms of trade. Prices are shown in Ugandan Shillings and include applicable taxes at checkout. Payment is due within the terms agreed for your account. Delivery timelines are estimates and may vary with season and location.': {
    sw: 'Oda zote zinazowekwa kupitia duka hili zinafuata masharti ya kawaida ya biashara ya Morise Holdings Limited. Bei zinaonyeshwa kwa Shilingi za Uganda na zinajumuisha kodi zinazotumika wakati wa kulipa. Malipo yanapaswa kufanywa ndani ya masharti yaliyokubaliwa kwa akaunti yako. Muda wa uwasilishaji ni makadirio na unaweza kutofautiana kulingana na msimu na eneo.',
    lg: 'Odda zonna eziteekebwa okuyita mu ddwaliro lino zigoberera endagaano entongole ez’obusuubuzi eza Morise Holdings Limited. Ebbeeyi ziragibwa mu Silingi za Uganda era zirimu omusolo ogukwatibwa nga osasula. Okusasula kwetaagisa mu biseera ebikkaanyiziddwa ku akaawunti yo. Ebiseera by’okutuusa kya kiteeso era biyinza okwawukana okusinziira ku kiseera n’ekifo.',
    fr: 'Toutes les commandes passées via cette boutique sont soumises aux conditions générales de vente de Morise Holdings Limited. Les prix sont indiqués en shillings ougandais et incluent les taxes applicables au moment du paiement. Le paiement est dû selon les conditions convenues pour votre compte. Les délais de livraison sont donnés à titre indicatif et peuvent varier selon la saison et le lieu.',
    es: 'Todos los pedidos realizados a través de esta tienda están sujetos a las condiciones generales de venta de Morise Holdings Limited. Los precios se muestran en chelines ugandeses e incluyen los impuestos aplicables al finalizar la compra. El pago vence según las condiciones acordadas para su cuenta. Los plazos de entrega son estimados y pueden variar según la temporada y la ubicación.',
    pt: 'Todos os pedidos feitos através desta loja estão sujeitos às condições gerais de venda da Morise Holdings Limited. Os preços são apresentados em xelins ugandeses e incluem os impostos aplicáveis no momento do pagamento. O pagamento é devido de acordo com as condições acordadas para a sua conta. Os prazos de entrega são estimativas e podem variar consoante a época e a localização.',
    de: 'Alle über diesen Shop aufgegebenen Bestellungen unterliegen den allgemeinen Geschäftsbedingungen von Morise Holdings Limited. Die Preise werden in Uganda-Schilling angezeigt und enthalten die beim Bezahlvorgang anfallenden Steuern. Die Zahlung ist gemäß den für Ihr Konto vereinbarten Bedingungen fällig. Lieferzeiten sind Schätzungen und können je nach Saison und Standort variieren.',
    it: 'Tutti gli ordini effettuati tramite questo negozio sono soggetti alle condizioni generali di vendita di Morise Holdings Limited. I prezzi sono indicati in scellini ugandesi e includono le imposte applicabili al momento del pagamento. Il pagamento è dovuto secondo le condizioni concordate per il tuo conto. I tempi di consegna sono stime e possono variare in base alla stagione e alla località.',
    ar: 'تخضع جميع الطلبات المقدَّمة عبر هذا المتجر لشروط التعامل القياسية لشركة Morise Holdings Limited. تُعرض الأسعار بالشلن الأوغندي وتشمل الضرائب المطبَّقة عند الدفع. يُستحق السداد وفق الشروط المتفق عليها لحسابك. مواعيد التسليم تقديرية وقد تختلف حسب الموسم والموقع.',
  },
  'We deliver to registered addresses on your account. A standard delivery fee applies per order. Goods damaged in transit may be reported through the Support screen within 48 hours of delivery.': {
    sw: 'Tunawasilisha kwa anwani zilizosajiliwa kwenye akaunti yako. Ada ya kawaida ya uwasilishaji inatozwa kwa kila oda. Bidhaa zilizoharibika njiani zinaweza kuripotiwa kupitia skrini ya Msaada ndani ya saa 48 baada ya kuwasilishwa.',
    lg: 'Tutuusa ku bbaluwa ez’endagiriro ezawandiisibwa ku akaawunti yo. Waliwo omuwendo gwa bulijjo ogw’okutuusa ku buli odda. Ebyamaguzi ebyonoonese mu kkubo biyinza okuloopebwa okuyita mu luuyi lwa Buyambi mu ssaawa 48 nga bituusiddwa.',
    fr: 'Nous livrons aux adresses enregistrées sur votre compte. Des frais de livraison standard s’appliquent par commande. Les marchandises endommagées pendant le transport peuvent être signalées via l’écran Assistance dans les 48 heures suivant la livraison.',
    es: 'Realizamos entregas en las direcciones registradas en su cuenta. Se aplica una tarifa de envío estándar por pedido. Las mercancías dañadas durante el transporte pueden notificarse a través de la pantalla de Soporte dentro de las 48 horas posteriores a la entrega.',
    pt: 'Entregamos nos endereços registados na sua conta. Aplica-se uma taxa de entrega padrão por pedido. As mercadorias danificadas em trânsito podem ser comunicadas através do ecrã de Apoio no prazo de 48 horas após a entrega.',
    de: 'Wir liefern an die in Ihrem Konto hinterlegten Adressen. Pro Bestellung fällt eine Standard-Liefergebühr an. Auf dem Transportweg beschädigte Ware kann innerhalb von 48 Stunden nach Lieferung über den Support-Bildschirm gemeldet werden.',
    it: 'Consegniamo agli indirizzi registrati sul tuo conto. Per ogni ordine si applica una tariffa di consegna standard. La merce danneggiata durante il trasporto può essere segnalata tramite la schermata Assistenza entro 48 ore dalla consegna.',
    ar: 'نقوم بالتوصيل إلى العناوين المسجَّلة في حسابك. تُطبَّق رسوم توصيل قياسية لكل طلب. يمكن الإبلاغ عن البضائع التالفة أثناء النقل عبر شاشة الدعم خلال 48 ساعة من التسليم.',
  },
};

// Token-level fallback: individual words translated where recognised, the
// rest of the string left as-is. Keys are lower-cased English words.
export const TOKENS: Record<string, Entry> = {
  per: { sw: 'kwa', lg: 'buli', fr: 'par', es: 'por', pt: 'por', de: 'pro', it: 'al', ar: 'لكل' },
  bag: { sw: 'Mfuko', lg: 'Ensawo', fr: 'Sac', es: 'Saco', pt: 'Saco', de: 'Sack', it: 'Sacco', ar: 'كيس' },
  piece: { sw: 'Kipande', lg: 'Kimu', fr: 'Pièce', es: 'Pieza', pt: 'Peça', de: 'Stück', it: 'Pezzo', ar: 'قطعة' },
  litre: { sw: 'Lita', lg: 'Lita', fr: 'Litre', es: 'Litro', pt: 'Litro', de: 'Liter', it: 'Litro', ar: 'لتر' },
  day: { sw: 'Siku', lg: 'Olunaku', fr: 'Jour', es: 'Día', pt: 'Dia', de: 'Tag', it: 'Giorno', ar: 'يوم' },
  jerrycan: { sw: 'Dumu', lg: 'Jerikeni', fr: 'Jerrican', es: 'Bidón', pt: 'Bidão', de: 'Kanister', it: 'Tanica', ar: 'جركن' },
  maize: { sw: 'Mahindi', lg: 'Kasooli', fr: 'Maïs', es: 'Maíz', pt: 'Milho', de: 'Mais', it: 'Mais', ar: 'ذرة' },
  bean: { sw: 'Maharage', lg: 'Ebijanjaalo', fr: 'Haricot', es: 'Frijol', pt: 'Feijão', de: 'Bohne', it: 'Fagiolo', ar: 'فاصوليا' },
  seed: { sw: 'Mbegu', lg: 'Ensigo', fr: 'Semence', es: 'Semilla', pt: 'Semente', de: 'Saatgut', it: 'Sementi', ar: 'بذور' },
  fertilizer: { sw: 'Mbolea', lg: 'Ebigimusa', fr: 'Engrais', es: 'Fertilizante', pt: 'Fertilizante', de: 'Dünger', it: 'Fertilizzante', ar: 'سماد' },
  herbicide: { sw: 'Dawa ya magugu', lg: 'Eddagala ly’omuddo', fr: 'Herbicide', es: 'Herbicida', pt: 'Herbicida', de: 'Herbizid', it: 'Erbicida', ar: 'مبيد أعشاب' },
  diesel: { sw: 'Dizeli', lg: 'Diiziitu', fr: 'Diesel', es: 'Diésel', pt: 'Diesel', de: 'Diesel', it: 'Gasolio', ar: 'ديزل' },
  bulk: { sw: 'Jumla', lg: 'Ekingi', fr: 'En vrac', es: 'A granel', pt: 'A granel', de: 'Lose', it: 'Sfuso', ar: 'سائب' },
  pallet: { sw: 'Kibao cha kubebea', lg: 'Kibaawo', fr: 'Palette', es: 'Palé', pt: 'Palete', de: 'Palette', it: 'Pallet', ar: 'منصة نقالة' },
  standard: { sw: 'Kawaida', lg: 'Eya bulijjo', fr: 'Standard', es: 'Estándar', pt: 'Padrão', de: 'Standard', it: 'Standard', ar: 'قياسي' },
  woven: { sw: 'Iliyofumwa', lg: 'Eluke', fr: 'Tissé', es: 'Tejido', pt: 'Tecido', de: 'Gewebt', it: 'Intrecciato', ar: 'منسوج' },
  sack: { sw: 'Gunia', lg: 'Kavera', fr: 'Sac', es: 'Costal', pt: 'Saca', de: 'Sack', it: 'Sacco', ar: 'جوال' },
  farm: { sw: 'Shamba', lg: 'Faamu', fr: 'Ferme', es: 'Granja', pt: 'Fazenda', de: 'Bauernhof', it: 'Fattoria', ar: 'مزرعة' },
  trailer: { sw: 'Trela', lg: 'Tureela', fr: 'Remorque', es: 'Remolque', pt: 'Reboque', de: 'Anhänger', it: 'Rimorchio', ar: 'مقطورة' },
  rental: { sw: 'Kukodisha', lg: 'Okupangisa', fr: 'Location', es: 'Alquiler', pt: 'Aluguel', de: 'Miete', it: 'Noleggio', ar: 'إيجار' },
  store: { sw: 'Duka', lg: 'Edduuka', fr: 'Magasin', es: 'Tienda', pt: 'Loja', de: 'Geschäft', it: 'Negozio', ar: 'متجر' },
  depot: { sw: 'Bohari', lg: 'Sitoowa', fr: 'Dépôt', es: 'Depósito', pt: 'Depósito', de: 'Depot', it: 'Deposito', ar: 'مستودع' },
  branch: { sw: 'Tawi', lg: 'Ettabi', fr: 'Succursale', es: 'Sucursal', pt: 'Filial', de: 'Filiale', it: 'Filiale', ar: 'فرع' },
  office: { sw: 'Ofisi', lg: 'Ofiisi', fr: 'Bureau', es: 'Oficina', pt: 'Escritório', de: 'Büro', it: 'Ufficio', ar: 'مكتب' },
  warehouse: { sw: 'Ghala', lg: 'Sitoowa', fr: 'Entrepôt', es: 'Almacén', pt: 'Armazém', de: 'Lager', it: 'Magazzino', ar: 'مستودع' },

  // Group storefront service-name tokens (29 August 2026): the recurring
  // words in the Logistics / Clearing & Forwarding / Warehouse Management
  // service names, so those catalogue rows render in the chosen language as
  // far as the glossary reaches (the rest passes through the provider seam).
  freight: { sw: 'Mizigo', lg: 'Emigugu', fr: 'Fret', es: 'Flete', pt: 'Frete', de: 'Fracht', it: 'Merci', ar: 'شحن' },
  forwarding: { sw: 'Usafirishaji', lg: 'Okusindika', fr: 'Transit', es: 'Agenciamiento', pt: 'Agenciamento', de: 'Spedition', it: 'Spedizione', ar: 'إرسال' },
  customs: { sw: 'Forodha', lg: 'Kasawo', fr: 'Douane', es: 'Aduana', pt: 'Alfândega', de: 'Zoll', it: 'Dogana', ar: 'الجمارك' },
  clearance: { sw: 'Uidhinishaji', lg: 'Okuggya', fr: 'Dédouanement', es: 'Despacho', pt: 'Desembaraço', de: 'Abfertigung', it: 'Sdoganamento', ar: 'تخليص' },
  transit: { sw: 'Njia', lg: 'Okuyita', fr: 'Transit', es: 'Tránsito', pt: 'Trânsito', de: 'Transit', it: 'Transito', ar: 'عبور' },
  documentation: { sw: 'Nyaraka', lg: 'Ebiwandiiko', fr: 'Documentation', es: 'Documentación', pt: 'Documentação', de: 'Dokumentation', it: 'Documentazione', ar: 'مستندات' },
  storage: { sw: 'Uhifadhi', lg: 'Okutereka', fr: 'Stockage', es: 'Almacenamiento', pt: 'Armazenamento', de: 'Lagerung', it: 'Stoccaggio', ar: 'تخزين' },
  handling: { sw: 'Ushughulikiaji', lg: 'Okukwata', fr: 'Manutention', es: 'Manipulación', pt: 'Manuseio', de: 'Handling', it: 'Movimentazione', ar: 'مناولة' },
  import: { sw: 'Uagizaji', lg: "Okuyingiza", fr: 'Importation', es: 'Importación', pt: 'Importação', de: 'Import', it: 'Importazione', ar: 'استيراد' },
  export: { sw: 'Usafirishaji nje', lg: 'Okufulumya', fr: 'Exportation', es: 'Exportación', pt: 'Exportação', de: 'Export', it: 'Esportazione', ar: 'تصدير' },
  ocean: { sw: 'Bahari', lg: 'Ennyanja', fr: 'Maritime', es: 'Marítimo', pt: 'Marítimo', de: 'See', it: 'Marittimo', ar: 'بحري' },
  air: { sw: 'Anga', lg: 'Empewo', fr: 'Aérien', es: 'Aéreo', pt: 'Aéreo', de: 'Luft', it: 'Aereo', ar: 'جوي' },
  road: { sw: 'Barabara', lg: 'Oluguudo', fr: 'Routier', es: 'Terrestre', pt: 'Rodoviário', de: 'Straße', it: 'Stradale', ar: 'بري' },
  delivery: { sw: 'Uwasilishaji', lg: 'Okutuusa', fr: 'Livraison', es: 'Entrega', pt: 'Entrega', de: 'Lieferung', it: 'Consegna', ar: 'توصيل' },
  border: { sw: 'Mpaka', lg: 'Ensalo', fr: 'Frontière', es: 'Frontera', pt: 'Fronteira', de: 'Grenze', it: 'Frontiera', ar: 'حدود' },
  bonded: { sw: 'Dhamana', lg: 'Ey’omusingo', fr: 'Sous douane', es: 'En depósito', pt: 'Alfandegado', de: 'Zolllager', it: 'Doganale', ar: 'مستودع جمركي' },
  cold: { sw: 'Baridi', lg: 'Nnyogovu', fr: 'Froid', es: 'Frío', pt: 'Frio', de: 'Kühl', it: 'Freddo', ar: 'مبرّد' },
  ambient: { sw: 'Kawaida', lg: 'Ey’ebbugumu erya bulijjo', fr: 'Ambiant', es: 'Ambiente', pt: 'Ambiente', de: 'Umgebungstemperatur', it: 'Ambiente', ar: 'حرارة عادية' },
  inbound: { sw: 'Ingiao', lg: 'Ebiyingira', fr: 'Réception', es: 'Entrada', pt: 'Entrada', de: 'Wareneingang', it: 'In entrata', ar: 'وارد' },
  putaway: { sw: 'Kupanga', lg: 'Okutereka', fr: 'Rangement', es: 'Ubicación', pt: 'Arrumação', de: 'Einlagerung', it: 'Stoccaggio', ar: 'تخزين' },
  dispatch: { sw: 'Kutuma', lg: 'Okusindika', fr: 'Expédition', es: 'Despacho', pt: 'Expedição', de: 'Versand', it: 'Spedizione', ar: 'إرسال' },
  visit: { sw: 'Ziara', lg: 'Okukyala', fr: 'Visite', es: 'Visita', pt: 'Visita', de: 'Besuch', it: 'Visita', ar: 'زيارة' },
  entry: { sw: 'Ingizo', lg: 'Okuyingira', fr: 'Déclaration', es: 'Declaración', pt: 'Declaração', de: 'Anmeldung', it: 'Dichiarazione', ar: 'بيان' },
  permit: { sw: 'Kibali', lg: 'Olukusa', fr: 'Permis', es: 'Permiso', pt: 'Autorização', de: 'Genehmigung', it: 'Permesso', ar: 'تصريح' },
  certificate: { sw: 'Cheti', lg: 'Satifikeeti', fr: 'Certificat', es: 'Certificado', pt: 'Certificado', de: 'Zertifikat', it: 'Certificato', ar: 'شهادة' },
  bond: { sw: 'Dhamana', lg: 'Omusingo', fr: 'Caution', es: 'Fianza', pt: 'Fiança', de: 'Bürgschaft', it: 'Cauzione', ar: 'سند ضمان' },
  container: { sw: 'Kontena', lg: 'Kontena', fr: 'Conteneur', es: 'Contenedor', pt: 'Contentor', de: 'Container', it: 'Container', ar: 'حاوية' },
  consolidation: { sw: 'Muunganisho', lg: 'Okugatta', fr: 'Groupage', es: 'Consolidación', pt: 'Consolidação', de: 'Sammelgut', it: 'Consolidamento', ar: 'تجميع' },
  month: { sw: 'Mwezi', lg: 'Omwezi', fr: 'Mois', es: 'Mes', pt: 'Mês', de: 'Monat', it: 'Mese', ar: 'شهر' },
  pick: { sw: 'Kuchagua', lg: 'Okulonda', fr: 'Préparation', es: 'Preparación', pt: 'Separação', de: 'Kommissionierung', it: 'Prelievo', ar: 'انتقاء' },
  pack: { sw: 'Kufunga', lg: 'Okupakinga', fr: 'Emballage', es: 'Embalaje', pt: 'Embalagem', de: 'Verpackung', it: 'Imballaggio', ar: 'تغليف' },
  count: { sw: 'Hesabu', lg: 'Okubala', fr: 'Comptage', es: 'Recuento', pt: 'Contagem', de: 'Zählung', it: 'Conteggio', ar: 'جرد' },
  cycle: { sw: 'Mzunguko', lg: 'Empija', fr: 'Cyclique', es: 'Cíclico', pt: 'Cíclica', de: 'Zyklus', it: 'Ciclico', ar: 'دوري' },
  services: { sw: 'Huduma', lg: 'Obuweereza', fr: 'Services', es: 'Servicios', pt: 'Serviços', de: 'Dienste', it: 'Servizi', ar: 'خدمات' },

  // Collateral-management service-name tokens (30 August 2026).
  collateral: { sw: 'Dhamana', lg: 'Omusingo', fr: 'Garantie', es: 'Garantía', pt: 'Garantia', de: 'Sicherheit', it: 'Garanzia', ar: 'ضمان' },
  custody: { sw: 'Uhifadhi', lg: 'Okukuuma', fr: 'Garde', es: 'Custodia', pt: 'Custódia', de: 'Verwahrung', it: 'Custodia', ar: 'حفظ' },
  control: { sw: 'Udhibiti', lg: 'Okufuga', fr: 'Contrôle', es: 'Control', pt: 'Controlo', de: 'Kontrolle', it: 'Controllo', ar: 'رقابة' },
  inspection: { sw: 'Ukaguzi', lg: 'Okukebera', fr: 'Inspection', es: 'Inspección', pt: 'Inspeção', de: 'Inspektion', it: 'Ispezione', ar: 'تفتيش' },
  verification: { sw: 'Uthibitishaji', lg: 'Okukakasa', fr: 'Vérification', es: 'Verificación', pt: 'Verificação', de: 'Verifizierung', it: 'Verifica', ar: 'تحقق' },
  sampling: { sw: 'Sampuli', lg: 'Okuggyako akaboko', fr: 'Échantillonnage', es: 'Muestreo', pt: 'Amostragem', de: 'Probenahme', it: 'Campionamento', ar: 'أخذ عينات' },
  valuation: { sw: 'Uthaminishaji', lg: 'Okubalirira omuwendo', fr: 'Valorisation', es: 'Valoración', pt: 'Avaliação', de: 'Bewertung', it: 'Valutazione', ar: 'تقييم' },
  coverage: { sw: 'Ufunikaji', lg: 'Okubikka', fr: 'Couverture', es: 'Cobertura', pt: 'Cobertura', de: 'Deckung', it: 'Copertura', ar: 'تغطية' },
  reconciliation: { sw: 'Ulinganishaji', lg: 'Okukwataganya', fr: 'Rapprochement', es: 'Conciliación', pt: 'Reconciliação', de: 'Abstimmung', it: 'Riconciliazione', ar: 'تسوية' },
  variance: { sw: 'Tofauti', lg: 'Enjawulo', fr: 'Écart', es: 'Discrepancia', pt: 'Divergência', de: 'Abweichung', it: 'Scostamento', ar: 'فرق' },
  release: { sw: 'Utoaji', lg: 'Okuta', fr: 'Libération', es: 'Liberación', pt: 'Libertação', de: 'Freigabe', it: 'Rilascio', ar: 'إفراج' },
  authorization: { sw: 'Idhini', lg: 'Olukusa', fr: 'Autorisation', es: 'Autorización', pt: 'Autorização', de: 'Genehmigung', it: 'Autorizzazione', ar: 'تفويض' },
  receipt: { sw: 'Risiti', lg: 'Lisiiti', fr: 'Récépissé', es: 'Recibo', pt: 'Recibo', de: 'Empfangsschein', it: 'Ricevuta', ar: 'إيصال' },
  reporting: { sw: 'Uripoti', lg: 'Okuwa alipoota', fr: 'Reporting', es: 'Informes', pt: 'Relatórios', de: 'Berichtswesen', it: 'Rendicontazione', ar: 'إعداد التقارير' },
  compliance: { sw: 'Uzingatiaji', lg: 'Okugoberera amateeka', fr: 'Conformité', es: 'Cumplimiento', pt: 'Conformidade', de: 'Compliance', it: 'Conformità', ar: 'الامتثال' },
  gauging: { sw: 'Upimaji', lg: 'Okupima', fr: 'Jaugeage', es: 'Aforo', pt: 'Aferição', de: 'Peilung', it: 'Misurazione', ar: 'قياس' },
  accreditation: { sw: 'Uidhinishaji rasmi', lg: 'Okukkirizibwa', fr: 'Accréditation', es: 'Acreditación', pt: 'Acreditação', de: 'Akkreditierung', it: 'Accreditamento', ar: 'اعتماد' },
  facility: { sw: 'Kituo', lg: 'Ekifo', fr: 'Installation', es: 'Instalación', pt: 'Instalação', de: 'Anlage', it: 'Struttura', ar: 'منشأة' },
  agreement: { sw: 'Makubaliano', lg: 'Endagaano', fr: 'Contrat', es: 'Acuerdo', pt: 'Acordo', de: 'Vereinbarung', it: 'Contratto', ar: 'اتفاقية' },
  monitoring: { sw: 'Ufuatiliaji', lg: 'Okulondoola', fr: 'Suivi', es: 'Seguimiento', pt: 'Monitorização', de: 'Überwachung', it: 'Monitoraggio', ar: 'مراقبة' },
  onboarding: { sw: 'Usajili', lg: 'Okuyingiza', fr: 'Intégration', es: 'Incorporación', pt: 'Integração', de: 'Onboarding', it: 'Attivazione', ar: 'إعداد الحساب' },
  weighbridge: { sw: 'Mizani ya barabarani', lg: 'Ekipimo ky’oku luguudo', fr: 'Pont-bascule', es: 'Báscula puente', pt: 'Balança de ponte', de: 'Brückenwaage', it: 'Pesa a ponte', ar: 'ميزان جسري' },
  silo: { sw: 'Silo', lg: 'Ttanka y’emmere', fr: 'Silo', es: 'Silo', pt: 'Silo', de: 'Silo', it: 'Silo', ar: 'صومعة' },
  tank: { sw: 'Tangi', lg: 'Ttanka', fr: 'Citerne', es: 'Tanque', pt: 'Tanque', de: 'Tank', it: 'Serbatoio', ar: 'خزان' },
  quality: { sw: 'Ubora', lg: 'Omutindo', fr: 'Qualité', es: 'Calidad', pt: 'Qualidade', de: 'Qualität', it: 'Qualità', ar: 'جودة' },
  quantity: { sw: 'Kiasi', lg: 'Obungi', fr: 'Quantité', es: 'Cantidad', pt: 'Quantidade', de: 'Menge', it: 'Quantità', ar: 'كمية' },
  lender: { sw: 'Mkopeshaji', lg: 'Awola', fr: 'Prêteur', es: 'Prestamista', pt: 'Mutuante', de: 'Kreditgeber', it: 'Finanziatore', ar: 'المُقرِض' },
  portal: { sw: 'Lango', lg: 'Omulyango gwa yintaneeti', fr: 'Portail', es: 'Portal', pt: 'Portal', de: 'Portal', it: 'Portale', ar: 'بوابة' },
  position: { sw: 'Nafasi', lg: 'Embeera', fr: 'Position', es: 'Posición', pt: 'Posição', de: 'Position', it: 'Posizione', ar: 'مركز' },
  negotiable: { sw: 'Inayoweza kuhamishwa', lg: 'Esobola okuwanyisibwa', fr: 'Négociable', es: 'Negociable', pt: 'Negociável', de: 'Übertragbar', it: 'Negoziabile', ar: 'قابل للتداول' },
};

// ---- Reverse indexes (translated → English), built once ----
type Reverse = Record<GlossaryLang, Record<string, string>>;

function buildReverse(src: Record<string, Entry>): Reverse {
  const out = {} as Reverse;
  for (const l of GLOSSARY_LANGS) out[l] = {};
  for (const [english, entry] of Object.entries(src)) {
    for (const l of GLOSSARY_LANGS) {
      const v = entry[l];
      if (v) out[l][v.toLocaleLowerCase()] = english;
    }
  }
  return out;
}

export const PHRASES_REVERSE = buildReverse(PHRASES);
export const TOKENS_REVERSE = buildReverse(TOKENS);
