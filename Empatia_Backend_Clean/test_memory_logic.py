
import json
import logging

# Configurar logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_memory")

def manage_profile(current_profile: dict, action: str, category: str, detail: str, old_detail: str = None) -> dict:
    """
    Simulates the logic to be implemented in agent.py for manage_memory tool.
    Supports actions: 'add', 'update', 'delete'.
    """
    if current_profile is None:
        current_profile = {}
    
    if category not in current_profile:
        current_profile[category] = []
    
    # Normalize to list if it's not (just in case)
    if not isinstance(current_profile[category], list):
         current_profile[category] = [str(current_profile[category])]

    entry_list = current_profile[category]
    
    if action == "add":
        if detail not in entry_list:
            entry_list.append(detail)
            logger.info(f"Added: {detail}")
        else:
            logger.info(f"Detail already exists: {detail}")

    elif action == "delete":
        # Delete by exact match or try to find partial match if needed (but exact is safer for now)
        target = old_detail if old_detail else detail
        if target in entry_list:
            entry_list.remove(target)
            logger.info(f"Deleted: {target}")
        else:
            logger.warning(f"Could not find item to delete: {target}")

    elif action == "update":
        # Find old_detail and replace with detail
        if old_detail and old_detail in entry_list:
            idx = entry_list.index(old_detail)
            entry_list[idx] = detail
            logger.info(f"Updated: '{old_detail}' -> '{detail}'")
        else:
            # If old_detail not found, should we just add? 
            # Use case: modifying a preference. Better to warn.
            logger.warning(f"Could not find old detail to update: {old_detail}")
            # Optional fallback: add new
            entry_list.append(detail)
            logger.info(f"Fallback: Added new detail '{detail}'")

    return current_profile

def test_memory_management():
    print("--- Testing Memory Management Logic ---")
    
    profile = {}
    
    # 1. ADD
    print("\nTest 1: ADD 'Tem um cão Rodolfo'")
    profile = manage_profile(profile, "add", "family", "Tem um cão Rodolfo")
    print(f"Result: {json.dumps(profile)}")
    assert "Tem um cão Rodolfo" in profile["family"]

    # 2. ADD another
    print("\nTest 2: ADD 'Tem um neto Bernardo'")
    profile = manage_profile(profile, "add", "family", "Tem um neto Bernardo")
    assert len(profile["family"]) == 2

    # 3. UPDATE (Rodolfo passed away)
    # Scenario: Agent wants to change "Tem um cão Rodolfo" to "O cão Rodolfo faleceu"
    print("\nTest 3: UPDATE 'Tem um cão Rodolfo' -> 'O cão Rodolfo faleceu'")
    profile = manage_profile(profile, "update", "family", "O cão Rodolfo faleceu", old_detail="Tem um cão Rodolfo")
    print(f"Result: {json.dumps(profile)}")
    assert "O cão Rodolfo faleceu" in profile["family"]
    assert "Tem um cão Rodolfo" not in profile["family"]

    # 4. DELETE
    # Scenario: User says "Actually, I don't have a grandson named Bernardo, that was a mistake"
    print("\nTest 4: DELETE 'Tem um neto Bernardo'")
    profile = manage_profile(profile, "delete", "family", "", old_detail="Tem um neto Bernardo")
    print(f"Result: {json.dumps(profile)}")
    assert "Tem um neto Bernardo" not in profile["family"]

    # 5. MIXED ACTIONS
    print("\nTest 5: Complex Flow (New dog Zé)")
    profile = manage_profile(profile, "add", "family", "Tem um novo cão chamado Zé")
    assert "Tem um novo cão chamado Zé" in profile["family"]
    
    print("\nSUCCESS: All management tests passed!")

if __name__ == "__main__":
    test_memory_management()
