# generate_hash.py
from passlib.context import CryptContext
import getpass

# Контекст должен быть точной копией того, что в app/security.py
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def generate_hash():
    """
    Безопасно запрашивает пароль и генерирует для него хеш pbkdf2_sha256.
    """
    try:
        # getpass скрывает ввод пароля в терминале для безопасности
        password = getpass.getpass("Введите пароль для хеширования: ")
        if not password:
            print("Пароль не может быть пустым.")
            return

        hashed_password = pwd_context.hash(password)

        print("\n" + "="*50)
        print("Хеш успешно сгенерирован!")
        print("Алгоритм: pbkdf2_sha256")
        print("Ваш новый хеш:")
        print(hashed_password)
        print("="*50)
        print("\nСкопируйте этот хеш и используйте в SQL-запросе.")

    except Exception as e:
        print(f"\nПроизошла ошибка: {e}")

if __name__ == "__main__":
    generate_hash()