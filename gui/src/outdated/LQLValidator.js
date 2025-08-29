/ LQLValidator.js
// Validates LQL interface definitions against the ANTLR4 grammar

class LQLValidator {
    constructor() {
        // Token patterns from the ANTLR4 grammar
        this.patterns = {
            NAME: /^[$a-zA-Z_][$a-zA-Z0-9_]*$/,
            FILTERVALUE: /^[a-zA-Z_\\*!][a-zA-Z0-9_:'"\\*'^']*$/,
            TEXT: /^'[^'\r\n]*'$/,
            SPACE: /^\s+$/
        };
    }

    /**
     * Validates an LQL interface definition
     * @param {string} lqlText - The LQL interface text to validate
     * @returns {Object} - { isValid: boolean, errors: string[] }
     */
    validate(lqlText) {
        if (!lqlText || lqlText.trim() === '') {
            return { isValid: true, errors: [] }; // Empty is valid (optional interfaceSpec)
        }

        const errors = [];
        const trimmed = lqlText.trim();

        try {
            // Basic structure validation
            this.validateBasicStructure(trimmed, errors);

            if (errors.length === 0) {
                // Detailed parsing validation
                this.validateDetailedSyntax(trimmed, errors);
            }
        } catch (error) {
            errors.push(`Parsing error: ${error.message}`);
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    validateBasicStructure(text, errors) {
        // Check for balanced braces
        const braceBalance = this.checkBalancedBraces(text);
        if (braceBalance !== 0) {
            errors.push('Unbalanced curly braces in interface definition');
        }

        // Check for balanced parentheses
        const parenBalance = this.checkBalancedParens(text);
        if (parenBalance !== 0) {
            errors.push('Unbalanced parentheses in method signatures');
        }

        // Only check angle brackets if they exist in the text
        if (text.includes('<') || text.includes('>')) {
            const angleBalance = this.checkBalancedAngles(text);
            if (angleBalance !== 0) {
                errors.push('Unbalanced angle brackets in generic types');
            }
        }
    }

    validateDetailedSyntax(text, errors) {
        // Remove comments and normalize whitespace
        const cleaned = this.cleanText(text);

        // Try to parse the main structure
        const interfaceMatch = cleaned.match(/^([^{]+)\s*\{([^}]*)\}\s*(.*)$/s);

        if (!interfaceMatch) {
            errors.push('Invalid interface structure. Expected format: TypeName { method signatures }');
            return;
        }

        const [, typeDecl, methodsBlock, remaining] = interfaceMatch;

        // Validate type declaration
        this.validateTypeDeclaration(typeDecl.trim(), errors);

        // Validate methods block
        this.validateMethodsBlock(methodsBlock, errors);

        // Check for any remaining content (should only be filters)
        if (remaining.trim()) {
            this.validateFilters(remaining.trim(), errors);
        }
    }

    validateTypeDeclaration(typeDecl, errors) {
        // Should be either simpletype or qualifiedtype
        if (!this.isValidTypeName(typeDecl)) {
            errors.push(`Invalid type name: "${typeDecl}". Must be a valid identifier or qualified name (e.g., com.example.MyInterface)`);
        }
    }

    validateMethodsBlock(methodsText, errors) {
        if (!methodsText.trim()) {
            return; // Empty methods block is valid
        }

        // Split by lines and process each potential method signature
        const lines = methodsText.split(/[;\n]/).map(line => line.trim()).filter(line => line);

        for (const line of lines) {
            this.validateMethodSignature(line, errors);
        }
    }

    validateMethodSignature(methodSig, errors) {
        const trimmed = methodSig.trim();
        if (!trimmed) return;

        // Method signature patterns:
        // NAME ( inputs? ) -> outputs?
        // NAME ( inputs? )

        const methodMatch = trimmed.match(/^([^(]+)\s*\(([^)]*)\)(?:\s*->\s*(.+))?$/);

        if (!methodMatch) {
            errors.push(`Invalid method signature: "${trimmed}"`);
            return;
        }

        const [, methodName, inputs, outputs] = methodMatch;

        // Validate method name
        if (!this.patterns.NAME.test(methodName.trim())) {
            errors.push(`Invalid method name: "${methodName.trim()}"`);
        }

        // Validate inputs if present
        if (inputs.trim()) {
            this.validateParameters(inputs.trim(), errors, 'input');
        }

        // Validate outputs if present
        if (outputs && outputs.trim()) {
            this.validateParameters(outputs.trim(), errors, 'output');
        }
    }

    validateParameters(params, errors, context) {
        // Split by comma, but be careful with generics
        const paramList = this.splitParameters(params);

        for (const param of paramList) {
            this.validateParameter(param.trim(), errors, context);
        }
    }

    validateParameter(param, errors, context) {
        if (!param) return;

        // Parameter can be: simpletype, qualifiedtype, arraytype, namedparam, or typeparam

        // Check for named parameter (name = type)
        if (param.includes('=')) {
            const [name, type] = param.split('=').map(s => s.trim());
            if (!this.patterns.NAME.test(name)) {
                errors.push(`Invalid parameter name in ${context}: "${name}"`);
            }
            if (!this.isValidType(type)) {
                errors.push(`Invalid parameter type in ${context}: "${type}"`);
            }
            return;
        }

        // Check if it's a valid type
        if (!this.isValidType(param)) {
            errors.push(`Invalid ${context} parameter type: "${param}"`);
        }
    }

    isValidType(type) {
        if (!type) return false;

        // Remove array brackets for validation
        const withoutArrays = type.replace(/\[\]/g, '');

        // Check for generic type
        if (withoutArrays.includes('<')) {
            return this.isValidGenericType(withoutArrays);
        }

        // Check for qualified type
        if (withoutArrays.includes('.')) {
            return this.isValidQualifiedType(withoutArrays);
        }

        // Check for simple type
        return this.patterns.NAME.test(withoutArrays);
    }

    isValidGenericType(type) {
        const genericMatch = type.match(/^([^<]+)<(.+)>$/);
        if (!genericMatch) return false;

        const [, baseType, genericParams] = genericMatch;

        if (!this.isValidTypeName(baseType)) return false;

        const params = this.splitParameters(genericParams);
        return params.every(param => this.isValidType(param.trim()));
    }

    isValidQualifiedType(type) {
        const parts = type.split('.');
        return parts.every(part => this.patterns.NAME.test(part));
    }

    isValidTypeName(name) {
        if (name.includes('.')) {
            return this.isValidQualifiedType(name);
        }
        return this.patterns.NAME.test(name);
    }

    validateFilters(filtersText, errors) {
        // Filters should match FILTERVALUE pattern
        const filters = filtersText.split(/\s+/).filter(f => f);

        for (const filter of filters) {
            if (!this.patterns.FILTERVALUE.test(filter)) {
                errors.push(`Invalid filter: "${filter}"`);
            }
        }
    }

    // Utility methods
    splitParameters(params) {
        // Smart split that respects generic brackets
        const result = [];
        let current = '';
        let depth = 0;

        for (let i = 0; i < params.length; i++) {
            const char = params[i];

            if (char === '<') depth++;
            else if (char === '>') depth--;
            else if (char === ',' && depth === 0) {
                result.push(current.trim());
                current = '';
                continue;
            }

            current += char;
        }

        if (current.trim()) {
            result.push(current.trim());
        }

        return result;
    }

    checkBalancedBraces(text) {
        let count = 0;
        for (const char of text) {
            if (char === '{') count++;
            else if (char === '}') count--;
        }
        return count;
    }

    checkBalancedParens(text) {
        let count = 0;
        for (const char of text) {
            if (char === '(') count++;
            else if (char === ')') count--;
        }
        return count;
    }

    checkBalancedAngles(text) {
        let count = 0;
        for (const char of text) {
            if (char === '<') count++;
            else if (char === '>') count--;
        }
        return count;
    }

    cleanText(text) {
        // Remove single-line comments and normalize whitespace
        return text
            .replace(/\/\/.*$/gm, '') // Remove // comments
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }
}

export default LQLValidator;