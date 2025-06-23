import type { ApiUserBase } from "@/types";

type ApiSource = Pick<ApiUserBase, 'apiUrl' | 'apiMethod' | 'apiHeaders'>;

interface TestResult {
    success: true;
    userCount: number;
    data: number[];
}

interface TestError {
    success: false;
    error: string;
}

/**
 * Тестирует источник данных API.
 * Важно: Работает только если API разрешает CORS-запросы от этого домена.
 * @param source - Объект с данными для подключения к API.
 * @returns Результат с количеством пользователей или ошибкой.
 */
export async function testApiSource(source: ApiSource): Promise<TestResult | TestError> {
    if (!source.apiUrl) {
        return { success: false, error: 'API URL is not provided.' };
    }

    try {
        const headers = new Headers();
        if (source.apiHeaders) {
            source.apiHeaders.forEach(header => {
                if (header.key && header.value) {
                    headers.append(header.key, header.value);
                }
            });
        }

        const response = await fetch(source.apiUrl, {
            method: source.apiMethod || 'GET',
            headers: headers,
            // Добавляем mode: 'cors' для явного указания кросс-доменного запроса
            mode: 'cors', 
        });

        if (!response.ok) {
            return { success: false, error: `Request failed with status: ${response.status} ${response.statusText}` };
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            return { success: false, error: 'API response is not a valid JSON array.' };
        }

        const userIds = data.map(Number).filter(id => !isNaN(id));

        return {
            success: true,
            userCount: userIds.length,
            data: userIds,
        };

    } catch (error) {
        if (error instanceof TypeError) {
            // Это часто указывает на CORS-ошибку
            return { success: false, error: 'Network error. This might be a CORS issue. Please ensure the API allows requests from this origin.' };
        }
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: 'An unknown error occurred.' };
    }
} 