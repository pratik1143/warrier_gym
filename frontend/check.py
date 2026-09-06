import sys

def check_brackets(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    
    stack = []
    in_string = False
    string_char = ''
    in_comment = False
    in_line_comment = False

    for i, line in enumerate(lines):
        j = 0
        while j < len(line):
            c = line[j]
            if not in_string and not in_comment and not in_line_comment:
                if line[j:j+2] == '//':
                    in_line_comment = True
                    break
                elif line[j:j+2] == '/*':
                    in_comment = True
                    j += 1
                elif c in ['{', '(', '[']:
                    stack.append((c, i+1))
                elif c in ['}', ')', ']']:
                    if not stack:
                        print(f"Unmatched {c} at line {i+1}")
                    else:
                        last, last_line = stack.pop()
                        match = {'}': '{', ')': '(', ']': '['}
                        if match[c] != last:
                            print(f"Mismatched {c} at line {i+1}, expected closing for {last} from line {last_line}")
                elif c in ['"', "'", '`']:
                    in_string = True
                    string_char = c
            elif in_string:
                if c == string_char and (j == 0 or line[j-1] != '\\'):
                    in_string = False
            elif in_comment:
                if line[j:j+2] == '*/':
                    in_comment = False
                    j += 1
            j += 1
        in_line_comment = False
        
        # for ` we can have multiline strings
        # but single or double quotes shouldn't cross lines unless escaped (we'll ignore that edge case for now)

    for bracket, line in stack:
        print(f"Unclosed {bracket} from line {line}")

check_brackets('src/app/dashboard/members/page.tsx')
