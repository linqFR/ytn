import { describe, it, expect } from 'vitest';
import { QueryBuilder } from '../src/index.js';
import { z } from 'zod';

describe('QueryBuilder - Correctifs et Nouvelles Fonctionnalités', () => {

  describe('1. Méthode search() - Unification des paramètres', () => {
    it('doit générer une clause WHERE avec le paramètre nommé @search_term', () => {
      const sql = QueryBuilder.table('articles')
        .search(['title', 'content'])
        .build();

      expect(sql).toContain('WHERE (title LIKE @search_term OR content LIKE @search_term)');
      expect(sql).not.toContain('?'); // Vérifie l'absence de paramètres positionnels
    });

    it("doit combiner correctement la recherche avec d'autres conditions WHERE nommées", () => {
      const sql = QueryBuilder.table('articles')
        .search(['title'])
        .where(['status'])
        .build();

      expect(sql).toContain('WHERE (title LIKE @search_term) AND status = @status');
    });
  });

  describe("2. Méthode clone() - Isolation de l'état", () => {
    it("doit créer une instance indépendante sans muter l'originale", () => {
      const baseQuery = QueryBuilder.table('users').where(['is_active']);
      
      // On clone et on modifie le clone
      const clonedQuery = baseQuery.clone().limit(10).offset(20);
      
      const baseSql = baseQuery.build();
      const clonedSql = clonedQuery.build();

      // La requête de base doit rester intacte
      expect(baseSql).toBe('SELECT * FROM users WHERE is_active = @is_active');
      
      // Le clone doit contenir les nouvelles clauses
      expect(clonedSql).toBe('SELECT * FROM users WHERE is_active = @is_active LIMIT 10 OFFSET 20');
    });

    it('doit isoler les modifications des tableaux internes (Deep/Shallow copy)', () => {
      const baseQuery = QueryBuilder.table('logs').select(['id']);
      const clone = baseQuery.clone();

      clone.select(['id', 'message']); // Modifie les champs du clone
      clone.where(['level']); // Ajoute une condition au clone

      expect(baseQuery.build()).toBe('SELECT id FROM logs');
      expect(clone.build()).toBe('SELECT id, message FROM logs WHERE level = @level');
    });
  });

  describe('3. DDL Engine - Génération de la Clé Primaire', () => {
    it('doit générer une clause PRIMARY KEY pour une clé simple (string)', () => {
      const schema = z.object({
        custom_id: z.string(),
        name: z.string()
      });

      const sql = QueryBuilder.createTableFromZod('categories', schema, {
        primaryKey: 'custom_id'
      });

      expect(sql).toContain('PRIMARY KEY (custom_id)');
      expect(sql).not.toContain('PRIMARY KEY (c,u,s,t,o,m,_,i,d)'); // S'assure que la string n'est pas itérée comme un tableau
    });

    it('doit continuer à supporter les clés primaires composites (array)', () => {
      const schema = z.object({
        tenant_id: z.string(),
        user_id: z.string(),
        role: z.string()
      });

      const sql = QueryBuilder.createTableFromZod('tenant_users', schema, {
        primaryKey: ['tenant_id', 'user_id']
      });

      expect(sql).toContain('PRIMARY KEY (tenant_id, user_id)');
    });

    it('doit déduire correctement la clé primaire par convention (id)', () => {
      const schema = z.object({
        id: z.string(),
        email: z.string()
      });

      const sql = QueryBuilder.createTableFromZod('accounts', schema);

      expect(sql).toContain('PRIMARY KEY (id)');
    });
  });

});
