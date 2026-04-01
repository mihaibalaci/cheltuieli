const { parseABNAMROFile } = require('../parser');

describe('parseABNAMROFile — CSV (tab-delimited)', () => {
  it('parses standard ABN AMRO CSV format', () => {
    const csv = [
      '865474001\tEUR\t20240315\t1000.00\t950.00\t20240315\t-50.00\tAlbert Heijn betaling',
      '865474001\tEUR\t20240316\t950.00\t2950.00\t20240316\t2000.00\tSalaris Employer BV',
    ].join('\n');

    const txs = parseABNAMROFile(Buffer.from(csv), 'export.csv');
    expect(txs).toHaveLength(2);

    expect(txs[0]).toMatchObject({
      date: '2024-03-15',
      amount: 50,
      transaction_type: 'debit',
      account_number: '865474001',
      currency: 'EUR',
    });

    expect(txs[1]).toMatchObject({
      date: '2024-03-16',
      amount: 2000,
      transaction_type: 'credit',
    });
  });

  it('skips header rows', () => {
    const csv = [
      'Accountnumber\tCurrency\tTransactiedatum\tBalance\tBalance\tInterest\tAmount\tDescription',
      '865474001\tEUR\t20240315\t1000.00\t950.00\t20240315\t-50.00\tGroceries',
    ].join('\n');

    const txs = parseABNAMROFile(Buffer.from(csv), 'export.csv');
    expect(txs).toHaveLength(1);
  });

  it('handles empty file', () => {
    const txs = parseABNAMROFile(Buffer.from(''), 'empty.csv');
    expect(txs).toHaveLength(0);
  });

  it('skips lines with too few columns', () => {
    const csv = 'short\tline\n865474001\tEUR\t20240315\t1000\t950\t20240315\t-25\tValid';
    const txs = parseABNAMROFile(Buffer.from(csv), 'test.csv');
    expect(txs).toHaveLength(1);
  });
});

describe('parseABNAMROFile — MT940', () => {
  it('parses MT940 transaction blocks', () => {
    const mt940 = [
      ':20:STARTOFSTMT',
      ':25:ABNANL2A/865474001',
      ':28C:00001/001',
      ':60F:C240301EUR1000,00',
      ':61:240305D50,00N029NONREF',
      ':86:Albert Heijn /NAME/Albert Heijn BV',
      ':61:240310C2000,00N029NONREF',
      ':86:Salaris /NAME/Employer BV',
      ':62F:C2950,00EUR',
    ].join('\n');

    const txs = parseABNAMROFile(Buffer.from(mt940), 'export.mt940');
    expect(txs).toHaveLength(2);
    expect(txs[0].transaction_type).toBe('debit');
    expect(txs[0].amount).toBe(50);
    expect(txs[0].date).toBe('2024-03-05');
    expect(txs[1].transaction_type).toBe('credit');
    expect(txs[1].amount).toBe(2000);
  });

  it('extracts counterparty from /NAME/ pattern', () => {
    const mt940 = [
      ':20:STMT',
      ':61:240301D25,00N029REF',
      ':86:Betaling /NAME/Albert Heijn BV/REMI/groceries',
    ].join('\n');

    const txs = parseABNAMROFile(Buffer.from(mt940), 'test.mt940');
    expect(txs).toHaveLength(1);
    expect(txs[0].counterparty).toMatch(/Albert Heijn/);
  });
});

describe('parseABNAMROFile — format detection', () => {
  it('detects .tab extension as CSV', () => {
    const csv = '865474001\tEUR\t20240315\t1000\t950\t20240315\t-50\tTest';
    const txs = parseABNAMROFile(Buffer.from(csv), 'export.tab');
    expect(txs).toHaveLength(1);
  });

  it('detects .txt with MT940 content', () => {
    const mt940 = ':20:STMT\n:61:240301D10,00N029REF\n:86:Test payment';
    const txs = parseABNAMROFile(Buffer.from(mt940), 'export.txt');
    expect(txs).toHaveLength(1);
  });
});
